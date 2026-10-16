import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { awardBonuses } from "./award-bonuses";
import { onVerified } from "./on-verified";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.auditEvent.deleteMany();
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.zaloSwimPost.deleteMany();
  await db.zaloMessage.deleteMany();
  await db.tournamentZalo.deleteMany();
  await db.zaloBot.deleteMany();
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
/** A VERIFIED result for a new `distanceM` swim starting at `startedAt`. */
async function verified(userId: string, f: Fixture, distanceM: number, startedAt: string) {
  const start = new Date(startedAt);
  const s = await db.swim.create({
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
  return db.swimResult.create({
    data: {
      swimId: s.id,
      tournamentId: f.t.id,
      teamId: f.team.id,
      userId,
      status: "VERIFIED",
      reasons: [],
    },
  });
}

type Result = Awaited<ReturnType<typeof verified>>;

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
const award = (r: Result) => db.$transaction((tx) => awardBonuses(tx, r));
const bonusesOf = (swimResultId: string) =>
  db.pointsEntry.findMany({
    where: { swimResultId, kind: { not: "DISTANCE" } },
    orderBy: { kind: "asc" },
  });
const first = (points: number) => expect.objectContaining({ kind: "FIRST_SWIM_BONUS", points });
const long = (points: number) => expect.objectContaining({ kind: "LONG_SWIM_BONUS", points });

describe("awardBonuses", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-01T00:00:00+07:00") });
    await clean();
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("gives +20 for the first swim once, with the result, team and Vietnam day", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r1 = await verified(me.id, f, 500, "2026-06-01T06:00:00+07:00");
    const r2 = await verified(me.id, f, 500, "2026-06-02T06:00:00+07:00");

    await award(r1);
    await award(r2);

    expect(await bonusesOf(r1.id)).toEqual([
      expect.objectContaining({
        kind: "FIRST_SWIM_BONUS",
        points: 20,
        countedM: 0,
        swimResultId: r1.id,
        teamId: f.team.id,
        userId: me.id,
        tournamentId: f.t.id,
        vnDay: "2026-06-01",
      }),
    ]);
    expect(await bonusesOf(r2.id)).toEqual([]);
  });

  it("gives +10 for a 1.2 km swim", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 1200, "2026-06-01T06:00:00+07:00");

    await award(r);

    expect(await bonusesOf(r.id)).toEqual([first(20), long(10)]);
  });

  it("gives only +25 (not +10 as well) for a 3.2 km swim", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 3200, "2026-06-01T06:00:00+07:00");

    await award(r);

    expect(await bonusesOf(r.id)).toEqual([first(20), long(25)]);
  });

  it("gives one long-swim bonus for two long swims on the same Vietnam day", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const morning = await verified(me.id, f, 1500, "2026-06-01T06:00:00+07:00");
    const evening = await verified(me.id, f, 3500, "2026-06-01T23:30:00+07:00");

    await award(morning);
    await award(evening);

    expect(await bonusesOf(morning.id)).toEqual([first(20), long(10)]);
    expect(await bonusesOf(evening.id)).toEqual([]);
  });

  it("gives a long-swim bonus on each of two Vietnam days", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const late = await verified(me.id, f, 1500, "2026-06-01T23:30:00+07:00");
    const early = await verified(me.id, f, 1500, "2026-06-02T00:30:00+07:00");

    await award(late);
    await award(early);

    expect(await bonusesOf(late.id)).toEqual([first(20), long(10)]);
    expect(await bonusesOf(early.id)).toEqual([
      expect.objectContaining({ kind: "LONG_SWIM_BONUS", points: 10, vnDay: "2026-06-02" }),
    ]);
  });

  it("gives the first-swim bonus once in each of two tournaments", async () => {
    const me = await user("me");
    const one = await tournamentWith(me.id, "One");
    const two = await tournamentWith(me.id, "Two");
    const a = await verified(me.id, one, 500, "2026-06-01T06:00:00+07:00");
    const b = await verified(me.id, two, 500, "2026-06-01T07:00:00+07:00");

    await award(a);
    await award(b);

    expect(await bonusesOf(a.id)).toEqual([first(20)]);
    expect(await bonusesOf(b.id)).toEqual([first(20)]);
  });

  it("is idempotent: a second call for the same result inserts nothing", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 3200, "2026-06-01T06:00:00+07:00");

    await award(r);
    await award(r);

    expect(await bonusesOf(r.id)).toHaveLength(2);
  });

  it("reads the tournament's point values", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One", {
      firstSwimBonusPoints: 30,
      longSwimTier1M: 1500,
      longSwimTier1Points: 15,
    });
    const short = await verified(me.id, f, 1200, "2026-06-01T06:00:00+07:00");
    const r = await verified(me.id, f, 1600, "2026-06-01T07:00:00+07:00");

    await award(short);
    await award(r);

    expect(await bonusesOf(short.id)).toEqual([first(30)]);
    expect(await bonusesOf(r.id)).toEqual([long(15)]);
  });

  it("uses the distance after the longest-swim setting", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One", { longestSwimCountedM: 2000 });
    const r = await verified(me.id, f, 3200, "2026-06-01T06:00:00+07:00");

    await award(r);

    expect(await bonusesOf(r.id)).toEqual([first(20), long(10)]);
  });

  it("gives nothing for a result that is not verified", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 3200, "2026-06-01T06:00:00+07:00");
    const flagged = await db.swimResult.update({
      where: { id: r.id },
      data: { status: "FLAGGED" },
    });

    await award(flagged);

    expect(await db.pointsEntry.count()).toBe(0);
  });

  it("never gives two first-swim bonuses to concurrent verifications", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const results: Result[] = [];
    for (const h of ["06", "07", "08"]) {
      results.push(await verified(me.id, f, 1500, `2026-06-01T${h}:00:00+07:00`));
    }

    // All transactions are open before any award, and each keeps its new entries uncommitted
    // for a while, so without the player lock every one of them would see "no bonus yet".
    const allOpen = barrier(results.length);
    await Promise.all(
      results.map((r) =>
        db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1`;
          await allOpen();
          await awardBonuses(tx, r);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }),
      ),
    );

    const where = { tournamentId: f.t.id, userId: me.id };
    expect(await db.pointsEntry.count({ where: { ...where, kind: "FIRST_SWIM_BONUS" } })).toBe(1);
    expect(await db.pointsEntry.count({ where: { ...where, kind: "LONG_SWIM_BONUS" } })).toBe(1);
  });

  it("is called by onVerified after the distance points", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const r = await verified(me.id, f, 1200, "2026-06-01T06:00:00+07:00");

    await db.$transaction((tx) => onVerified(tx, r));

    const kinds = (await db.pointsEntry.findMany({ where: { swimResultId: r.id } })).map(
      (e) => e.kind,
    );
    expect(kinds.sort()).toEqual(["DISTANCE", "FIRST_SWIM_BONUS", "LONG_SWIM_BONUS"]);
    // 12 distance + 20 + 10 bonus points of the 1,000 needed for the 100 km route move the ship.
    expect((await db.team.findUniqueOrThrow({ where: { id: f.team.id } })).progressBp).toBe(420);
  });
});
