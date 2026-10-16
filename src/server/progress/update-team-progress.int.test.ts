import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwimResult } from "@prisma/client";
import { runChecks, type Tx } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { awardDistancePoints } from "@/server/scoring/award-distance-points";
import { updateTeamProgress } from "./update-team-progress";

async function clean() {
  await db.domainEvent.deleteMany();
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

  it("does nothing for a team that does not exist", async () => {
    await expect(
      db.$transaction((tx) => updateTeamProgress(tx, "no-tournament", "no-team", new Date())),
    ).resolves.toBeUndefined();
    expect(await db.domainEvent.count()).toBe(0);
  });
});
