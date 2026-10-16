import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwimType, SwimTypeAllowed } from "@prisma/client";
import { db } from "@/server/db";
import { getReviewQueue } from "@/server/review/queue";
import { getMySwim } from "@/server/swims/my-swims";
import { toOwnerSwimDto } from "@/server/swims/swim-dto";
import { runChecks } from "./run-checks";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.zaloSwimPost.deleteMany();
  await db.zaloMessage.deleteMany();
  await db.tournamentZalo.deleteMany();
  await db.badge.deleteMany();
  await db.weeklyResult.deleteMany();
  await db.weekSettlement.deleteMany();
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

/** A published tournament (1 May to 1 July 2026, Vietnam time) with `userId` in one team. */
async function tournamentWith(userId: string, name: string, swimTypeAllowed: SwimTypeAllowed) {
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
      swimTypeAllowed,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name}-team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({ data: { tournamentId: t.id, teamId: team.id, userId } });
  return { t, org };
}

/** A stored 1000 m swim in 30 min (3:00 / 100 m) on 1 June 2026: passes the standard checks. */
const storeSwim = (userId: string, swimType: SwimType, durationS = 1800) =>
  db.$transaction(async (tx) => {
    const swim = await tx.swim.create({
      data: {
        userId,
        source: "FIT",
        fileSha256: "f".repeat(64),
        originalFilename: "swim.fit",
        startedAt: new Date("2026-06-01T06:00:00+07:00"),
        endedAt: new Date("2026-06-01T06:30:00+07:00"),
        distanceM: 1000,
        durationS,
        swimType,
        sport: "swimming",
        isSwim: true,
      },
    });
    await runChecks(tx, swim);
    return swim;
  });

const resultIn = (swimId: string, tournamentId: string) =>
  db.swimResult.findUniqueOrThrow({ where: { swimId_tournamentId: { swimId, tournamentId } } });

const missedType = (allowed: string, value: string) => ({
  code: "SWIM_TYPE_NOT_ACCEPTED",
  params: { allowed, value },
});

describe("runChecks with tournament rule checks", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-01T00:00:00+07:00") });
    await clean();
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("marks an open-water swim RULE_MISSED in a pool-only tournament: no points, no review", async () => {
    const me = await user("me");
    const { t, org } = await tournamentWith(me.id, "Pool", "POOL_ONLY");
    const swim = await storeSwim(me.id, "OPEN_WATER");

    const result = await resultIn(swim.id, t.id);
    expect(result).toMatchObject({
      status: "RULE_MISSED",
      reasons: [missedType("POOL_ONLY", "OPEN_WATER")],
    });
    expect(await db.pointsEntry.count({ where: { swimResultId: result.id } })).toBe(0);
    expect(await getReviewQueue(org.id, t.id)).toEqual([]);
  });

  it("counts the same swim in another tournament that accepts any type", async () => {
    const me = await user("me");
    const pool = await tournamentWith(me.id, "Pool", "POOL_ONLY");
    const any = await tournamentWith(me.id, "Any", "ANY");
    const swim = await storeSwim(me.id, "OPEN_WATER");

    expect((await resultIn(swim.id, pool.t.id)).status).toBe("RULE_MISSED");
    const counted = await resultIn(swim.id, any.t.id);
    expect(counted).toMatchObject({ status: "VERIFIED", reasons: [] });
    expect(await db.pointsEntry.count({ where: { swimResultId: counted.id } })).toBeGreaterThan(0);

    const mine = await getMySwim(me.id, swim.id);
    const missed = mine?.results.find((r) => r.tournamentId === pool.t.id);
    expect(missed).toMatchObject({
      displayStatus: "ruleMissed",
      reasons: [missedType("POOL_ONLY", "OPEN_WATER")],
      points: { distance: 0, firstSwimBonus: 0, longSwimBonus: 0, total: 0 },
    });
    const stored = await db.swim.findUniqueOrThrow({
      where: { id: swim.id },
      include: { results: { include: { tournament: true } } },
    });
    const dto = toOwnerSwimDto(stored).results.find((r) => r.tournamentId === pool.t.id);
    expect(dto?.reasons).toEqual([missedType("POOL_ONLY", "OPEN_WATER")]);
  });

  it("verifies a pool swim, and a swim of unknown type, in a pool-only tournament", async () => {
    const me = await user("me");
    const { t } = await tournamentWith(me.id, "Pool", "POOL_ONLY");
    const pool = await storeSwim(me.id, "POOL");
    expect((await resultIn(pool.id, t.id)).status).toBe("VERIFIED");

    await db.pointsEntry.deleteMany();
    await db.domainEvent.deleteMany();
    await db.swimResult.deleteMany();
    await db.swim.deleteMany();
    const unknown = await storeSwim(me.id, "UNKNOWN");
    expect((await resultIn(unknown.id, t.id)).status).toBe("VERIFIED");
  });

  it("keeps a swim flagged by the standard checks FLAGGED, not rule missed", async () => {
    const me = await user("me");
    const { t } = await tournamentWith(me.id, "Pool", "POOL_ONLY");
    const swim = await storeSwim(me.id, "OPEN_WATER", 4000); // 6:40 / 100 m: too slow

    expect(await resultIn(swim.id, t.id)).toMatchObject({
      status: "FLAGGED",
      reasons: ["PACE_TOO_SLOW"],
    });
  });
});
