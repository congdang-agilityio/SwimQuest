import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwimResult } from "@prisma/client";
import { runChecks, type Tx } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { getProgressLeaderboard } from "@/server/leaderboard/progress-leaderboard";
import { awardDistancePoints } from "@/server/scoring/award-distance-points";
import { updateTeamProgress, type FinishLostReason } from "./update-team-progress";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.notification.deleteMany();
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

/**
 * A published tournament (1 May to 1 July 2026, Vietnam time) with a 10 km route at the default
 * 10 points per km, so the finish is at 100 team points, and one team holding `userIds`. The
 * first-swim and long-swim bonuses are 0 so the team points are the distance points only.
 */
async function teamOf(userIds: string[]) {
  const org = await user("org");
  const t = await db.tournament.create({
    data: {
      organizerId: org.id,
      name: "Race",
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-05-01T06:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 10000,
      firstSwimBonusPoints: 0,
      longSwimTier1Points: 0,
      longSwimTier2Points: 0,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: "Dolphins", emblemKey: "dolphin", memberLimit: 5 },
  });
  for (const userId of userIds) {
    await db.teamMember.create({ data: { tournamentId: t.id, teamId: team.id, userId } });
  }
  return { t, team };
}

let sha = 0;
/** A stored pool swim of `distanceM` metres at 2:00 / 100 m starting at `startedAt`. */
function storedSwim(userId: string, distanceM: number, startedAt = "2026-06-01T06:00:00+07:00") {
  const start = new Date(startedAt);
  const durationS = (distanceM / 100) * 120;
  return db.swim.create({
    data: {
      userId,
      source: "FIT",
      fileSha256: (++sha).toString(16).padStart(64, "0"),
      originalFilename: "swim.fit",
      startedAt: start,
      endedAt: new Date(start.getTime() + durationS * 1000),
      distanceM,
      durationS,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
    },
  });
}

/** Stores and checks a swim in its own transaction, as an upload does. */
async function swimAndCheck(userId: string, distanceM: number, hooks = {}) {
  const s = await storedSwim(userId, distanceM);
  await db.$transaction((tx) => runChecks(tx, s, hooks));
}

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

/**
 * Adds `points` (negative for a revocation) to the team at `at` and refreshes its progress in
 * the same transaction, as a revocation or a player move does.
 */
function changePoints(
  tournamentId: string,
  teamId: string,
  userId: string,
  points: number,
  at: string,
  reason?: FinishLostReason,
) {
  const now = new Date(at);
  return db.$transaction(async (tx) => {
    await tx.pointsEntry.create({
      data: {
        tournamentId,
        teamId,
        userId,
        kind: points < 0 ? "REVERSAL" : "DISTANCE",
        points,
        vnDay: "2026-06-01",
        createdAt: now,
      },
    });
    await updateTeamProgress(tx, tournamentId, teamId, now, reason);
  });
}

const teamRow = (id: string) => db.team.findUniqueOrThrow({ where: { id } });
const eventsOf = (type: string) =>
  db.domainEvent.findMany({ where: { type }, orderBy: { createdAt: "asc" } });

describe("updateTeamProgress", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-01T12:00:00+07:00") });
    await clean();
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("caches the team progress after a verified swim and emits the change", async () => {
    const me = await user("me");
    const { t, team } = await teamOf([me.id]);

    await swimAndCheck(me.id, 2450);

    const row = await teamRow(team.id);
    expect(row.progressBp).toBe(2400);
    expect(row.finishedAt).toBeNull();
    const changed = await eventsOf("TEAM_PROGRESS_CHANGED");
    expect(changed.map((e) => e.payload)).toEqual([
      { tournamentId: t.id, teamId: team.id, fromBp: 0, toBp: 2400 },
    ]);
    expect(await eventsOf("TEAM_FINISHED")).toEqual([]);
  });

  it("records no finish for a team below 100%", async () => {
    const me = await user("me");
    const { team } = await teamOf([me.id]);

    await swimAndCheck(me.id, 9990);

    const row = await teamRow(team.id);
    expect(row.progressBp).toBe(9900);
    expect(row.finishedAt).toBeNull();
    expect(await eventsOf("TEAM_FINISHED")).toEqual([]);
  });

  it("records the finish once when two swims cross the line at the same time", async () => {
    const a = await user("a");
    const b = await user("b");
    const c = await user("c");
    const { t, team } = await teamOf([a.id, b.id, c.id]);
    await swimAndCheck(a.id, 6000);

    // Each swim alone takes the team from 60 to 110 points. Both transactions hold their new
    // points before either updates the progress, so they really overlap.
    const bothAwarded = barrier(2);
    const hooks = {
      onVerified: async (tx: Tx, result: SwimResult, now: Date) => {
        await awardDistancePoints(tx, result);
        await bothAwarded();
        await updateTeamProgress(tx, result.tournamentId, result.teamId, now);
      },
    };
    await Promise.all([swimAndCheck(b.id, 5000, hooks), swimAndCheck(c.id, 5000, hooks)]);

    const row = await teamRow(team.id);
    expect(row.progressBp).toBe(10000);
    expect(row.finishedAt).toEqual(new Date("2026-06-01T12:00:00+07:00"));
    const finished = await eventsOf("TEAM_FINISHED");
    expect(finished.map((e) => e.payload)).toEqual([{ tournamentId: t.id, teamId: team.id }]);
    const changed = await eventsOf("TEAM_PROGRESS_CHANGED");
    expect(changed.map((e) => e.payload)).toEqual([
      { tournamentId: t.id, teamId: team.id, fromBp: 0, toBp: 6000 },
      { tournamentId: t.id, teamId: team.id, fromBp: 6000, toBp: 10000 },
    ]);
  });

  it("keeps the finish time while points keep growing after the finish", async () => {
    const me = await user("me");
    const { t, team } = await teamOf([me.id]);
    const finishAt = new Date("2026-06-01T08:00:00+07:00");
    const s = await storedSwim(me.id, 10000, "2026-06-01T05:00:00+07:00");
    await db.$transaction((tx) => runChecks(tx, s, {}, finishAt));

    const later = await storedSwim(me.id, 3000, "2026-06-02T06:00:00+07:00");
    await db.$transaction((tx) => runChecks(tx, later, {}, new Date("2026-06-02T08:00:00+07:00")));

    const row = await teamRow(team.id);
    expect(row.progressBp).toBe(10000);
    expect(row.finishedAt).toEqual(finishAt);
    expect(await eventsOf("TEAM_FINISHED")).toHaveLength(1);
    expect(await eventsOf("TEAM_PROGRESS_CHANGED")).toHaveLength(1);
    const points = await db.pointsEntry.aggregate({
      where: { tournamentId: t.id, teamId: team.id },
      _sum: { points: true },
    });
    expect(points._sum.points).toBe(130);
  });

  it("withdraws the finish when a revoked swim takes the team below 100%", async () => {
    const me = await user("me");
    const { t, team } = await teamOf([me.id]);
    await changePoints(t.id, team.id, me.id, 100, "2026-06-01T08:00:00+07:00");

    await changePoints(t.id, team.id, me.id, -30, "2026-06-02T09:00:00+07:00", "SWIM_REVOKED");

    const row = await teamRow(team.id);
    expect(row.progressBp).toBe(7000);
    expect(row.finishedAt).toBeNull();
    expect(row.finishLostAt).toEqual(new Date("2026-06-02T09:00:00+07:00"));
    expect(row.finishLostReason).toBe("SWIM_REVOKED");
    const lost = await eventsOf("TEAM_FINISH_LOST");
    expect(lost.map((e) => e.payload)).toEqual([{ tournamentId: t.id, teamId: team.id }]);
    const changed = await eventsOf("TEAM_PROGRESS_CHANGED");
    expect(changed.map((e) => e.payload)).toEqual([
      { tournamentId: t.id, teamId: team.id, fromBp: 0, toBp: 10000 },
      { tournamentId: t.id, teamId: team.id, fromBp: 10000, toBp: 7000 },
    ]);
  });

  it("records PLAYER_MOVED when a moved player's points take the team below 100%", async () => {
    const a = await user("a");
    const b = await user("b");
    const { t, team } = await teamOf([a.id, b.id]);
    const other = await db.team.create({
      data: { tournamentId: t.id, name: "Sharks", emblemKey: "shark", memberLimit: 5 },
    });
    await changePoints(t.id, team.id, a.id, 60, "2026-06-01T08:00:00+07:00");
    await changePoints(t.id, team.id, b.id, 50, "2026-06-01T09:00:00+07:00");

    const movedAt = new Date("2026-06-03T10:00:00+07:00");
    await db.$transaction(async (tx) => {
      await tx.pointsEntry.updateMany({ where: { userId: b.id }, data: { teamId: other.id } });
      for (const id of [team.id, other.id].sort()) {
        await updateTeamProgress(tx, t.id, id, movedAt, "PLAYER_MOVED");
      }
    });

    const row = await teamRow(team.id);
    expect(row.progressBp).toBe(6000);
    expect(row.finishedAt).toBeNull();
    expect(row.finishLostAt).toEqual(movedAt);
    expect(row.finishLostReason).toBe("PLAYER_MOVED");
    expect((await teamRow(other.id)).finishLostAt).toBeNull();
    expect(await eventsOf("TEAM_FINISH_LOST")).toHaveLength(1);
  });

  it("does not withdraw a finish while the team stays at 100%", async () => {
    const me = await user("me");
    const { team, t } = await teamOf([me.id]);
    await changePoints(t.id, team.id, me.id, 130, "2026-06-01T08:00:00+07:00");

    await changePoints(t.id, team.id, me.id, -30, "2026-06-02T09:00:00+07:00", "SWIM_REVOKED");

    const row = await teamRow(team.id);
    expect(row.finishedAt).toEqual(new Date("2026-06-01T08:00:00+07:00"));
    expect(row.finishLostAt).toBeNull();
    expect(await eventsOf("TEAM_FINISH_LOST")).toEqual([]);
  });

  it("records a new finish time when a withdrawn team reaches 100% again", async () => {
    const me = await user("me");
    const { t, team } = await teamOf([me.id]);
    await changePoints(t.id, team.id, me.id, 100, "2026-06-01T08:00:00+07:00");
    await changePoints(t.id, team.id, me.id, -30, "2026-06-02T09:00:00+07:00", "SWIM_REVOKED");

    await changePoints(t.id, team.id, me.id, 40, "2026-06-04T07:00:00+07:00");

    const row = await teamRow(team.id);
    expect(row.progressBp).toBe(10000);
    expect(row.finishedAt).toEqual(new Date("2026-06-04T07:00:00+07:00"));
    expect(row.finishLostAt).toBeNull();
    expect(row.finishLostReason).toBeNull();
    const finished = await eventsOf("TEAM_FINISHED");
    expect(finished.map((e) => e.payload)).toEqual([
      { tournamentId: t.id, teamId: team.id },
      { tournamentId: t.id, teamId: team.id },
    ]);
  });

  it("drops the withdrawn team from the finish on the leaderboard and ranks it by its new time", async () => {
    const a = await user("a");
    const b = await user("b");
    const { t, team: alpha } = await teamOf([a.id]);
    const bravo = await db.team.create({
      data: { tournamentId: t.id, name: "Bravo", emblemKey: "shark", memberLimit: 5 },
    });
    await db.teamMember.create({ data: { tournamentId: t.id, teamId: bravo.id, userId: b.id } });
    await changePoints(t.id, alpha.id, a.id, 100, "2026-06-01T08:00:00+07:00");
    await changePoints(t.id, alpha.id, a.id, -30, "2026-06-02T09:00:00+07:00", "SWIM_REVOKED");
    await changePoints(t.id, bravo.id, b.id, 100, "2026-06-03T08:00:00+07:00");

    const withdrawn = await getProgressLeaderboard(a.id, t.id);
    expect(withdrawn.map((r) => [r.teamId, r.progressBp])).toEqual([
      [bravo.id, 10000],
      [alpha.id, 7000],
    ]);

    await changePoints(t.id, alpha.id, a.id, 30, "2026-06-04T07:00:00+07:00");

    const rows = await getProgressLeaderboard(a.id, t.id);
    expect(rows.map((r) => [r.teamId, r.progressBp, r.reachedAt])).toEqual([
      [bravo.id, 10000, new Date("2026-06-03T08:00:00+07:00")],
      [alpha.id, 10000, new Date("2026-06-04T07:00:00+07:00")],
    ]);
    const finishOrder = await db.team.findMany({
      where: { tournamentId: t.id, finishedAt: { not: null } },
      orderBy: { finishedAt: "asc" },
      select: { id: true },
    });
    expect(finishOrder.map((r) => r.id)).toEqual([bravo.id, alpha.id]);
  });

  it("does nothing for a team that does not exist", async () => {
    await expect(
      db.$transaction((tx) => updateTeamProgress(tx, "no-tournament", "no-team", new Date())),
    ).resolves.toBeUndefined();
    expect(await db.domainEvent.count()).toBe(0);
  });
});
