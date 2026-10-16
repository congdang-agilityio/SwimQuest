import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { onVerified } from "@/server/scoring/on-verified";
import { awardBadge, removeBadge } from "./award";
import { checkPersonalBadgesOnVerified } from "./personal-rules";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.auditEvent.deleteMany();
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.zaloSwimPost.deleteMany();
  await db.zaloMessage.deleteMany();
  await db.tournamentZalo.deleteMany();
  await db.zaloBot.deleteMany();
  await db.weekSettlement.deleteMany();
  await db.xpEntry.deleteMany();
  await db.badge.deleteMany();
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

/** A published tournament with `userId` in its one team. */
async function tournamentWith(userId: string, name: string) {
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
/** A VERIFIED result of a `distanceM` swim whose counted metres are already `countedM`. */
async function verified(userId: string, f: Fixture, distanceM: number, countedM = 0) {
  const start = new Date(`2026-06-01T06:00:00+07:00`);
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
      countedM,
    },
  });
}

type Result = Awaited<ReturnType<typeof verified>>;

const check = (r: Result) => db.$transaction((tx) => checkPersonalBadgesOnVerified(tx, r));
const badgesOf = (userId: string, tournamentId?: string) =>
  db.badge.findMany({ where: { userId, tournamentId }, orderBy: { kind: "asc" } });

function barrier(count: number) {
  let arrived = 0;
  let release!: () => void;
  const all = new Promise<void>((resolve) => (release = resolve));
  return () => {
    if (++arrived === count) release();
    return all;
  };
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("checkPersonalBadgesOnVerified", () => {
  it("gives Participation once on the first verified result, through onVerified", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");

    const first = await verified(me.id, f, 1000);
    await db.$transaction((tx) => onVerified(tx, first));
    const second = await verified(me.id, f, 1000);
    await db.$transaction((tx) => onVerified(tx, second));

    const badges = await badgesOf(me.id);
    expect(badges).toEqual([
      expect.objectContaining({
        kind: "PARTICIPATION",
        tournamentId: f.t.id,
        teamId: f.team.id,
        removedAt: null,
      }),
    ]);
    const events = await db.domainEvent.findMany({ where: { type: "BADGE_AWARDED" } });
    expect(events.map((e) => e.payload)).toEqual([
      { tournamentId: f.t.id, userId: me.id, badgeKey: "PARTICIPATION" },
    ]);
  });

  it("gives no Conqueror at 49.9 km and gives it at 50 km counted", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");

    await check(await verified(me.id, f, 30000, 30000));
    await check(await verified(me.id, f, 19900, 19900));
    expect((await badgesOf(me.id)).map((b) => b.kind)).toEqual(["PARTICIPATION"]);

    await check(await verified(me.id, f, 500, 100));
    expect((await badgesOf(me.id)).map((b) => b.kind)).toEqual(["PARTICIPATION", "CONQUEROR"]);

    await check(await verified(me.id, f, 5000, 5000));
    expect(await db.badge.count({ where: { kind: "CONQUEROR" } })).toBe(1);
  });

  it("counts only verified results of the player in that tournament for Conqueror", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const other = await verified(me.id, f, 40000, 40000);
    await db.swimResult.update({ where: { id: other.id }, data: { status: "REJECTED" } });

    await check(await verified(me.id, f, 10000, 10000));

    expect((await badgesOf(me.id)).map((b) => b.kind)).toEqual(["PARTICIPATION"]);
  });

  it("keeps badges of two tournaments independent", async () => {
    const me = await user("me");
    const one = await tournamentWith(me.id, "One");
    const two = await tournamentWith(me.id, "Two");

    await check(await verified(me.id, one, 50000, 50000));
    await check(await verified(me.id, two, 1000, 1000));

    expect((await badgesOf(me.id, one.t.id)).map((b) => b.kind)).toEqual([
      "PARTICIPATION",
      "CONQUEROR",
    ]);
    expect((await badgesOf(me.id, two.t.id)).map((b) => b.kind)).toEqual(["PARTICIPATION"]);
  });

  it("awards each badge once to concurrent verifications", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const results: Result[] = [];
    for (let i = 0; i < 3; i++) results.push(await verified(me.id, f, 25000, 25000));

    // Every transaction is open before any check and keeps its badge uncommitted for a while,
    // so without the badge lock each one would see "no badge yet".
    const allOpen = barrier(results.length);
    await Promise.all(
      results.map((res) =>
        db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1`;
          await allOpen();
          await checkPersonalBadgesOnVerified(tx, res);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }),
      ),
    );

    expect((await badgesOf(me.id)).map((b) => b.kind)).toEqual(["PARTICIPATION", "CONQUEROR"]);
    expect(await db.domainEvent.count({ where: { type: "BADGE_AWARDED" } })).toBe(2);
  });

  it("writes no points or XP entries", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");

    await check(await verified(me.id, f, 50000, 50000));

    expect(await db.badge.count()).toBe(2);
    expect(await db.pointsEntry.count()).toBe(0);
    expect(await db.xpEntry.count()).toBe(0);
  });

  it("ignores a result that is not verified", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const res = await verified(me.id, f, 50000, 50000);

    await check({ ...res, status: "FLAGGED" });

    expect(await db.badge.count()).toBe(0);
  });
});

describe("awardBadge and removeBadge", () => {
  it("removes an active badge, keeps the row, and allows a new award afterwards", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const target = { tournamentId: f.t.id, userId: me.id, kind: "CONQUEROR" as const };

    expect(await db.$transaction((tx) => awardBadge(tx, target))).toBe(true);
    expect(await db.$transaction((tx) => awardBadge(tx, target))).toBe(false);
    expect(await db.$transaction((tx) => removeBadge(tx, target, "swim revoked"))).toBe(true);
    expect(await db.$transaction((tx) => removeBadge(tx, target, "again"))).toBe(false);

    const [removed] = await badgesOf(me.id);
    expect(removed.removedAt).toBeInstanceOf(Date);
    expect(removed.removedReason).toBe("swim revoked");
    const events = await db.domainEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.type)).toEqual(["BADGE_AWARDED", "BADGE_REMOVED"]);
    expect(events[1].payload).toEqual({
      tournamentId: f.t.id,
      userId: me.id,
      badgeKey: "CONQUEROR",
    });

    expect(await db.$transaction((tx) => awardBadge(tx, target))).toBe(true);
    expect(await db.badge.count({ where: { userId: me.id } })).toBe(2);
  });

  it("stores the reason and giver of a manual badge", async () => {
    const me = await user("me");
    const f = await tournamentWith(me.id, "One");
    const org = f.t.organizerId;

    await db.$transaction((tx) =>
      awardBadge(tx, {
        tournamentId: f.t.id,
        userId: me.id,
        kind: "SPECIAL",
        reason: "Helped a teammate",
        givenById: org,
      }),
    );

    const [badge] = await badgesOf(me.id);
    expect(badge).toMatchObject({ reason: "Helped a teammate", givenById: org, teamId: null });
  });
});
