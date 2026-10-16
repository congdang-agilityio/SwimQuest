import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getPlayerStats } from "./stats";

async function clean() {
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

async function tournament(organizerId: string, name: string) {
  const t = await db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      pointsPerKm: 10,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: `${name} team`, emblemKey: "dolphin", memberLimit: 5 },
  });
  return { t, team };
}

let n = 0;
async function swim(userId: string, distanceM: number, startedAt: string) {
  n += 1;
  const start = new Date(startedAt);
  return db.swim.create({
    data: {
      userId,
      source: "GPX",
      fileSha256: `sha${n}`,
      originalFilename: `f${n}.gpx`,
      startedAt: start,
      endedAt: new Date(start.getTime() + 1800_000),
      distanceM,
      durationS: 1800,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
    },
  });
}

const result = (
  swimId: string,
  userId: string,
  t: { id: string },
  team: { id: string },
  status: "VERIFIED" | "FLAGGED" | "REJECTED" | "DUPLICATE" | "REVOKED" | "RULE_MISSED",
) =>
  db.swimResult.create({
    data: { swimId, userId, tournamentId: t.id, teamId: team.id, status, reasons: [] },
  });

describe("getPlayerStats", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns zeros for a player with nothing", async () => {
    const me = await user("me");
    expect(await getPlayerStats(me.id)).toEqual({
      verifiedSwims: 0,
      verifiedDistanceM: 0,
      activeDays: 0,
      tournamentsJoined: 0,
      teams: 0,
      currentProgress: [],
      badges: 0,
    });
  });

  it("counts only verified swims; other statuses are excluded", async () => {
    const me = await user("me");
    const { t, team } = await tournament(me.id, "T");
    await db.teamMember.create({ data: { tournamentId: t.id, teamId: team.id, userId: me.id } });
    const statuses = [
      "VERIFIED",
      "FLAGGED",
      "REJECTED",
      "DUPLICATE",
      "REVOKED",
      "RULE_MISSED",
    ] as const;
    for (const [i, s] of statuses.entries()) {
      const sw = await swim(me.id, 1000 + i, `2026-11-0${i + 1}T08:00:00+07:00`);
      await result(sw.id, me.id, t, team, s);
    }
    const stats = await getPlayerStats(me.id);
    expect(stats.verifiedSwims).toBe(1);
    expect(stats.verifiedDistanceM).toBe(1000);
    expect(stats.activeDays).toBe(1);
  });

  it("ignores other players' swims", async () => {
    const me = await user("me");
    const other = await user("other");
    const { t, team } = await tournament(me.id, "T");
    const sw = await swim(other.id, 2000, "2026-11-02T08:00:00+07:00");
    await result(sw.id, other.id, t, team, "VERIFIED");
    expect((await getPlayerStats(me.id)).verifiedSwims).toBe(0);
  });

  it("counts a swim verified in two tournaments once", async () => {
    const me = await user("me");
    const a = await tournament(me.id, "A");
    const b = await tournament(me.id, "B");
    const sw = await swim(me.id, 1500, "2026-11-02T08:00:00+07:00");
    await result(sw.id, me.id, a.t, a.team, "VERIFIED");
    await result(sw.id, me.id, b.t, b.team, "VERIFIED");
    const stats = await getPlayerStats(me.id);
    expect(stats.verifiedSwims).toBe(1);
    expect(stats.verifiedDistanceM).toBe(1500);
  });

  it("counts a swim verified in one tournament and rejected in another", async () => {
    const me = await user("me");
    const a = await tournament(me.id, "A");
    const b = await tournament(me.id, "B");
    const sw = await swim(me.id, 800, "2026-11-02T08:00:00+07:00");
    await result(sw.id, me.id, a.t, a.team, "REJECTED");
    await result(sw.id, me.id, b.t, b.team, "VERIFIED");
    expect((await getPlayerStats(me.id)).verifiedSwims).toBe(1);
  });

  it("active days need a verified swim of 500 m or more, by Vietnam day", async () => {
    const me = await user("me");
    const { t, team } = await tournament(me.id, "T");
    const specs: [number, string][] = [
      [499, "2026-11-01T08:00:00+07:00"], // too short
      [500, "2026-11-02T08:00:00+07:00"], // day 2
      [900, "2026-11-02T18:00:00+07:00"], // day 2 again
      [600, "2026-11-03T06:00:00+07:00"], // 2026-11-02T23:00Z -> VN day 3
    ];
    for (const [d, at] of specs) {
      const sw = await swim(me.id, d, at);
      await result(sw.id, me.id, t, team, "VERIFIED");
    }
    const unverified = await swim(me.id, 5000, "2026-11-10T08:00:00+07:00");
    await result(unverified.id, me.id, t, team, "FLAGGED");
    const stats = await getPlayerStats(me.id);
    expect(stats.verifiedSwims).toBe(4);
    expect(stats.activeDays).toBe(2);
    expect(stats.verifiedDistanceM).toBe(499 + 500 + 900 + 600);
  });

  it("counts tournaments and teams from active and ended memberships, progress from current teams", async () => {
    const me = await user("me");
    const a = await tournament(me.id, "A");
    const b = await tournament(me.id, "B");
    const a2 = await db.team.create({
      data: { tournamentId: a.t.id, name: "A2", emblemKey: "whale", memberLimit: 5 },
    });
    await db.teamMember.create({
      data: {
        tournamentId: a.t.id,
        teamId: a.team.id,
        userId: me.id,
        status: "LEFT",
        endedAt: new Date(),
        endReason: "LEFT",
      },
    });
    await db.teamMember.create({ data: { tournamentId: a.t.id, teamId: a2.id, userId: me.id } });
    await db.teamMember.create({
      data: {
        tournamentId: b.t.id,
        teamId: b.team.id,
        userId: me.id,
        status: "REMOVED",
        endedAt: new Date(),
        endReason: "REMOVED_AFTER_START",
      },
    });
    await db.pointsEntry.create({
      data: {
        tournamentId: a.t.id,
        teamId: a2.id,
        userId: me.id,
        kind: "DISTANCE",
        points: 500,
        countedM: 50000,
        vnDay: "2026-11-02",
      },
    });
    const stats = await getPlayerStats(me.id);
    expect(stats.tournamentsJoined).toBe(2);
    expect(stats.teams).toBe(3);
    expect(stats.currentProgress).toHaveLength(1);
    expect(stats.currentProgress[0]).toMatchObject({ tournamentId: a.t.id, teamId: a2.id });
    expect(stats.currentProgress[0].progress.progressBp).toBe(5000);
  });

  it("counts active badges across tournaments, not removed ones", async () => {
    const me = await user("me");
    const a = await tournament(me.id, "A");
    const b = await tournament(me.id, "B");
    await db.badge.create({ data: { tournamentId: a.t.id, userId: me.id, kind: "PARTICIPATION" } });
    await db.badge.create({ data: { tournamentId: b.t.id, userId: me.id, kind: "PARTICIPATION" } });
    await db.badge.create({
      data: { tournamentId: b.t.id, userId: me.id, kind: "EXPLORER", removedAt: new Date() },
    });
    expect((await getPlayerStats(me.id)).badges).toBe(2);
  });

  it("rejects an empty user id", async () => {
    await expect(getPlayerStats("")).rejects.toThrow();
  });
});
