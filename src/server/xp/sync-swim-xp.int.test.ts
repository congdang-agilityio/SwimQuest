import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { onVerified } from "@/server/scoring/on-verified";
import { syncSwimXp } from "./sync-swim-xp";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.badge.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

/** A published tournament (May to July 2026, Vietnam time) with `userId` in its one team. */
async function tournamentWith(
  userId: string,
  name: string,
  settings: Partial<Prisma.TournamentUncheckedCreateInput> = {},
) {
  const org = await user(`org-${name}`);
  const t = await db.tournament.create({
    data: {
      organizerId: org.id,
      name,
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-05-01T06:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      ...settings,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name}-team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({ data: { tournamentId: t.id, teamId: team.id, userId } });
  return { t, team };
}

type Fixture = Awaited<ReturnType<typeof tournamentWith>>;

let sha = 0;
async function swimOf(userId: string, distanceM: number, startedAt: string) {
  const start = new Date(startedAt);
  return db.swim.create({
    data: {
      userId,
      source: "FIT",
      fileSha256: (++sha).toString(16).padStart(64, "0"),
      originalFilename: "swim.fit",
      startedAt: start,
      endedAt: new Date(start.getTime() + 3600_000),
      distanceM,
      durationS: 3600,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
    },
  });
}

const resultOf = (swimId: string, userId: string, f: Fixture) =>
  db.swimResult.create({
    data: {
      swimId,
      tournamentId: f.t.id,
      teamId: f.team.id,
      userId,
      status: "VERIFIED",
      reasons: [],
    },
  });

/** A promise every caller awaits until `count` callers have arrived. */
function barrier(count: number) {
  let arrived = 0;
  let release!: () => void;
  const all = new Promise<void>((resolve) => (release = resolve));
  return () => {
    if (++arrived === count) release();
    return all;
  };
}

const sync = (swimId: string) => db.$transaction((tx) => syncSwimXp(tx, swimId));
const xpOf = (userId: string) =>
  db.xpEntry.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { kind: "asc" }] });
const totalOf = async (userId: string) =>
  (await db.xpEntry.aggregate({ where: { userId }, _sum: { xp: true } }))._sum.xp ?? 0;
const levelEvents = () =>
  db.domainEvent.findMany({ where: { type: "LEVEL_CHANGED" }, orderBy: { createdAt: "asc" } });
const entry = (kind: string, xp: number) => expect.objectContaining({ kind, xp });

describe("syncSwimXp", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-01T00:00:00+07:00") });
    await clean();
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("awards XP with platform values when the tournament uses other values", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "Custom", {
      pointsPerKm: 20,
      firstSwimBonusPoints: 50,
      longSwimTier2Points: 60,
      longestSwimCountedM: 2000,
    });
    const s = await swimOf(me.id, 3500, "2026-06-01T06:00:00+07:00");
    const r = await resultOf(s.id, me.id, f);

    await db.$transaction((tx) => onVerified(tx, r));

    const rows = await db.xpEntry.findMany({ where: { swimId: s.id }, orderBy: { kind: "asc" } });
    expect(rows).toEqual([
      expect.objectContaining({ kind: "DISTANCE", xp: 35, userId: me.id, vnDay: "2026-06-01" }),
      expect.objectContaining({ kind: "FIRST_SWIM_BONUS", xp: 20 }),
      expect.objectContaining({ kind: "LONG_SWIM_BONUS", xp: 25 }),
    ]);
    expect((await levelEvents()).map((e) => e.payload)).toEqual([
      { userId: me.id, fromLevel: 1, toLevel: 2 },
    ]);
  });

  it("awards a swim that counts in two tournaments once", async () => {
    const me = await user("me");
    const a = await tournamentWith(me.id, "A");
    const b = await tournamentWith(me.id, "B", { pointsPerKm: 20 });
    const s = await swimOf(me.id, 1500, "2026-06-01T06:00:00+07:00");
    const ra = await resultOf(s.id, me.id, a);
    const rb = await resultOf(s.id, me.id, b);

    await db.$transaction(async (tx) => {
      await onVerified(tx, ra);
      await onVerified(tx, rb);
    });
    await sync(s.id);

    expect(await xpOf(me.id)).toHaveLength(3);
    expect(await totalOf(me.id)).toBe(15 + 20 + 10);
  });

  it("gives the first-swim bonus once ever and the long-swim bonus once per Vietnam day", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const s1 = await swimOf(me.id, 1200, "2026-06-01T06:00:00+07:00");
    const s2 = await swimOf(me.id, 3200, "2026-06-01T18:00:00+07:00");
    const s3 = await swimOf(me.id, 1000, "2026-06-02T06:00:00+07:00");
    for (const s of [s1, s2, s3]) {
      await resultOf(s.id, me.id, f);
      await sync(s.id);
    }

    const kinds = (swimId: string) =>
      db.xpEntry.findMany({ where: { swimId }, orderBy: { kind: "asc" } });
    expect(await kinds(s1.id)).toEqual([
      entry("DISTANCE", 12),
      entry("FIRST_SWIM_BONUS", 20),
      entry("LONG_SWIM_BONUS", 10),
    ]);
    expect(await kinds(s2.id)).toEqual([entry("DISTANCE", 32)]);
    expect(await kinds(s3.id)).toEqual([entry("DISTANCE", 10), entry("LONG_SWIM_BONUS", 10)]);
  });

  it("counts a swim up to 10 km and a Vietnam day up to 10 km", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One", { longestSwimCountedM: 50_000 });
    const long = await swimOf(me.id, 12_000, "2026-06-03T06:00:00+07:00");
    const a = await swimOf(me.id, 8000, "2026-06-01T06:00:00+07:00");
    const b = await swimOf(me.id, 5000, "2026-06-01T18:00:00+07:00");
    const c = await swimOf(me.id, 2000, "2026-06-01T20:00:00+07:00");
    for (const s of [long, a, b, c]) {
      await resultOf(s.id, me.id, f);
      await sync(s.id);
    }

    const distance = async (swimId: string) =>
      (await db.xpEntry.findFirstOrThrow({ where: { swimId, kind: "DISTANCE" } })).xp;
    expect(await distance(long.id)).toBe(100);
    expect([await distance(a.id), await distance(b.id), await distance(c.id)]).toEqual([80, 20, 0]);
  });

  it("reverses the XP when the only verified result is revoked, and the level drops", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const s = await swimOf(me.id, 3500, "2026-06-01T06:00:00+07:00");
    const r = await resultOf(s.id, me.id, f);
    await sync(s.id);
    const originals = await xpOf(me.id);

    await db.swimResult.update({ where: { id: r.id }, data: { status: "REVOKED" } });
    await sync(s.id);
    await sync(s.id);

    const reversals = await db.xpEntry.findMany({ where: { kind: "REVERSAL" } });
    expect(reversals).toHaveLength(3);
    for (const o of originals) {
      expect(reversals).toContainEqual(
        expect.objectContaining({ userId: me.id, swimId: null, reversesId: o.id, xp: -o.xp }),
      );
    }
    expect(await totalOf(me.id)).toBe(0);
    expect((await levelEvents()).map((e) => e.payload)).toEqual([
      { userId: me.id, fromLevel: 1, toLevel: 2 },
      { userId: me.id, fromLevel: 2, toLevel: 1 },
    ]);
  });

  it("keeps the XP while another tournament still counts the swim", async () => {
    const me = await user("me");
    const a = await tournamentWith(me.id, "A");
    const b = await tournamentWith(me.id, "B");
    const s = await swimOf(me.id, 1500, "2026-06-01T06:00:00+07:00");
    const ra = await resultOf(s.id, me.id, a);
    await resultOf(s.id, me.id, b);
    await sync(s.id);

    await db.swimResult.update({ where: { id: ra.id }, data: { status: "REVOKED" } });
    await sync(s.id);

    expect(await db.xpEntry.count({ where: { kind: "REVERSAL" } })).toBe(0);
    expect(await totalOf(me.id)).toBe(45);
  });

  it("lets a later swim that day use the room a reversed swim left", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const a = await swimOf(me.id, 8000, "2026-06-01T06:00:00+07:00");
    const b = await swimOf(me.id, 4000, "2026-06-01T18:00:00+07:00");
    const ra = await resultOf(a.id, me.id, f);
    await sync(a.id);
    await db.swimResult.update({ where: { id: ra.id }, data: { status: "REVOKED" } });
    await sync(a.id);

    await resultOf(b.id, me.id, f);
    await sync(b.id);

    expect(
      await db.xpEntry.findMany({ where: { swimId: b.id }, orderBy: { kind: "asc" } }),
    ).toEqual([entry("DISTANCE", 40), entry("LONG_SWIM_BONUS", 25)]);
  });

  it("serializes concurrent swims of the same day", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const swims = [
      await swimOf(me.id, 6000, "2026-06-01T06:00:00+07:00"),
      await swimOf(me.id, 6000, "2026-06-01T18:00:00+07:00"),
    ];
    for (const s of swims) await resultOf(s.id, me.id, f);

    const arrive = barrier(2);
    await Promise.all(
      swims.map((s) =>
        db.$transaction(async (tx) => {
          await arrive();
          await syncSwimXp(tx, s.id);
        }),
      ),
    );

    const rows = await xpOf(me.id);
    const sum = (kind: string) => rows.filter((e) => e.kind === kind).reduce((n, e) => n + e.xp, 0);
    expect(sum("DISTANCE")).toBe(100);
    expect(rows.filter((e) => e.kind === "FIRST_SWIM_BONUS")).toHaveLength(1);
    expect(rows.filter((e) => e.kind === "LONG_SWIM_BONUS")).toHaveLength(1);
  });
});
