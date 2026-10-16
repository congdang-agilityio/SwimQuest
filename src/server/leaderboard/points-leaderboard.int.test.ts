import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { LeaderboardError } from "./progress-leaderboard";
import { getKmLeaderboard, getPointsLeaderboard } from "./points-leaderboard";

async function clean() {
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function setup(names: string[]) {
  const org = await user("org");
  const t = await db.tournament.create({
    data: {
      organizerId: org.id,
      name: "T",
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const out = [];
  for (const name of names) {
    const team = await db.team.create({
      data: { tournamentId: t.id, name, emblemKey: `e-${name}`, memberLimit: 5 },
    });
    const u = await user(`u-${name}`);
    await db.teamMember.create({
      data: { tournamentId: t.id, teamId: team.id, userId: u.id, status: "ACTIVE" },
    });
    out.push({ team, u });
  }
  return { org, t, out };
}

const entry = (
  t: string,
  teamId: string,
  userId: string,
  kind: "DISTANCE" | "FIRST_SWIM_BONUS" | "REVERSAL",
  points: number,
  countedM: number,
) =>
  db.pointsEntry.create({
    data: { tournamentId: t, teamId, userId, kind, points, countedM, vnDay: "2026-11-02" },
  });

describe("points and km leaderboards", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("ranks a finished team with more points first and keeps points only on rows", async () => {
    const { t, out } = await setup(["Beta", "Alpha", "Done"]);
    const [beta, alpha, done] = out;
    await db.team.update({ where: { id: done.team.id }, data: { finishedAt: new Date() } });
    await entry(t.id, done.team.id, done.u.id, "DISTANCE", 1000, 100000);
    await entry(t.id, done.team.id, done.u.id, "DISTANCE", 300, 30000);
    await entry(t.id, alpha.team.id, alpha.u.id, "DISTANCE", 50, 5000);
    await entry(t.id, beta.team.id, beta.u.id, "DISTANCE", 50, 5000);

    const rows = await getPointsLeaderboard(beta.u.id, t.id);
    expect(rows.map((r) => [r.name, r.points, r.isMyTeam])).toEqual([
      ["Done", 1300, false],
      ["Alpha", 50, false],
      ["Beta", 50, true],
    ]);
    expect(rows[0]).not.toHaveProperty("countedM");
  });

  it("km ignores bonuses and a revoked swim reduces km; rows carry only countedM", async () => {
    const { org, t, out } = await setup(["A", "B"]);
    const [a, b] = out;
    await entry(t.id, a.team.id, a.u.id, "DISTANCE", 20, 2000);
    await entry(t.id, a.team.id, a.u.id, "FIRST_SWIM_BONUS", 500, 0);
    await entry(t.id, b.team.id, b.u.id, "DISTANCE", 30, 3000);
    await entry(t.id, b.team.id, b.u.id, "REVERSAL", -30, -3000);
    await entry(t.id, b.team.id, b.u.id, "DISTANCE", 10, 1000);

    const rows = await getKmLeaderboard(org.id, t.id);
    expect(rows.map((r) => [r.name, r.countedM, r.isMyTeam])).toEqual([
      ["A", 2000, false],
      ["B", 1000, false],
    ]);
    expect(rows[0]).not.toHaveProperty("points");
  });

  it("ties go by team name", async () => {
    const { org, t } = await setup(["Zed", "Abe"]);
    expect((await getKmLeaderboard(org.id, t.id)).map((r) => r.name)).toEqual(["Abe", "Zed"]);
    expect((await getPointsLeaderboard(org.id, t.id)).map((r) => r.name)).toEqual(["Abe", "Zed"]);
  });

  it("refuses outsiders, former members and unknown tournaments", async () => {
    const { t, out } = await setup(["A"]);
    const stranger = await user("stranger");
    await db.teamMember.update({
      where: { tournamentId_userId: { tournamentId: t.id, userId: out[0].u.id } },
      data: { status: "LEFT" },
    });
    for (const fn of [getPointsLeaderboard, getKmLeaderboard]) {
      await expect(fn(stranger.id, t.id)).rejects.toBeInstanceOf(LeaderboardError);
      await expect(fn(out[0].u.id, t.id)).rejects.toBeInstanceOf(LeaderboardError);
      await expect(fn(stranger.id, "nope")).rejects.toBeInstanceOf(LeaderboardError);
    }
  });
});
