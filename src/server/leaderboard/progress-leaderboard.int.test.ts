import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getProgressLeaderboard, LeaderboardError } from "./progress-leaderboard";

async function clean() {
  await db.pointsEntry.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

// 100 km * 10 points/km = 1000 points for the whole route.
async function tournament(organizerId: string, teamNames: string[]) {
  const t = await db.tournament.create({
    data: {
      organizerId,
      name: "T",
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const teams = [];
  for (const name of teamNames) {
    teams.push(
      await db.team.create({
        data: { tournamentId: t.id, name, emblemKey: `e-${name}`, memberLimit: 5 },
      }),
    );
  }
  return { t, teams };
}

const join = (
  tournamentId: string,
  teamId: string,
  userId: string,
  status: "ACTIVE" | "LEFT" = "ACTIVE",
) => db.teamMember.create({ data: { tournamentId, teamId, userId, status } });

const entry = (
  tournamentId: string,
  teamId: string,
  userId: string,
  points: number,
  at: string,
  kind: "DISTANCE" | "REVERSAL" = "DISTANCE",
) =>
  db.pointsEntry.create({
    data: {
      tournamentId,
      teamId,
      userId,
      kind,
      points,
      vnDay: "2026-11-02",
      createdAt: new Date(at),
    },
  });

describe("progress leaderboard", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("ranks by progress, flags my team and lists 0-point teams last with null reachedAt", async () => {
    const [org, u1, u2, u3] = await Promise.all(["org", "u1", "u2", "u3"].map(user));
    const { t, teams } = await tournament(org.id, ["Zero", "Low", "High"]);
    const [zero, low, high] = teams;
    await join(t.id, low.id, u1.id);
    await join(t.id, high.id, u2.id);
    await join(t.id, zero.id, u3.id);
    await entry(t.id, low.id, u1.id, 100, "2026-11-02T01:00:00Z");
    await entry(t.id, high.id, u2.id, 250, "2026-11-02T02:00:00Z");
    await entry(t.id, high.id, u2.id, 250, "2026-11-03T02:00:00Z");

    const rows = await getProgressLeaderboard(u1.id, t.id);
    expect(rows).toEqual([
      {
        teamId: high.id,
        name: "High",
        emblemKey: "e-High",
        progressBp: 5000,
        routeKmReached: 50,
        reachedAt: new Date("2026-11-03T02:00:00Z"),
        isMyTeam: false,
      },
      {
        teamId: low.id,
        name: "Low",
        emblemKey: "e-Low",
        progressBp: 1000,
        routeKmReached: 10,
        reachedAt: new Date("2026-11-02T01:00:00Z"),
        isMyTeam: true,
      },
      {
        teamId: zero.id,
        name: "Zero",
        emblemKey: "e-Zero",
        progressBp: 0,
        routeKmReached: 0,
        reachedAt: null,
        isMyTeam: false,
      },
    ]);
  });

  it("breaks a tie below 100% by who reached that progress first, not by name", async () => {
    const [org, u1, u2, u3] = await Promise.all(["org", "u1", "u2", "u3"].map(user));
    const { t, teams } = await tournament(org.id, ["Alpha", "Bravo"]);
    const [alpha, bravo] = teams;
    await join(t.id, alpha.id, u1.id);
    await join(t.id, bravo.id, u2.id);
    await join(t.id, bravo.id, u3.id);
    // Alpha reaches 300 points (30%) on day 3; Bravo reaches 300 on day 2 across two members.
    await entry(t.id, alpha.id, u1.id, 300, "2026-11-03T00:00:00Z");
    await entry(t.id, bravo.id, u2.id, 200, "2026-11-01T00:00:00Z");
    await entry(t.id, bravo.id, u3.id, 100, "2026-11-02T00:00:00Z");

    const rows = await getProgressLeaderboard(org.id, t.id);
    expect(rows.map((r) => [r.name, r.progressBp, r.reachedAt?.toISOString()])).toEqual([
      ["Bravo", 3000, "2026-11-02T00:00:00.000Z"],
      ["Alpha", 3000, "2026-11-03T00:00:00.000Z"],
    ]);
    expect(rows.every((r) => !r.isMyTeam)).toBe(true);
  });

  it("uses the time the tied progress was first reached even when points kept growing", async () => {
    const [org, u1, u2] = await Promise.all(["org", "u1", "u2"].map(user));
    const { t, teams } = await tournament(org.id, ["Alpha", "Bravo"]);
    const [alpha, bravo] = teams;
    await join(t.id, alpha.id, u1.id);
    await join(t.id, bravo.id, u2.id);
    // Both end at 305 points = 30.5% (3050 bp); Alpha got to 305 first via a later small entry.
    await entry(t.id, alpha.id, u1.id, 305, "2026-11-02T00:00:00Z");
    await entry(t.id, bravo.id, u2.id, 300, "2026-11-01T00:00:00Z");
    await entry(t.id, bravo.id, u2.id, 5, "2026-11-04T00:00:00Z");

    const rows = await getProgressLeaderboard(u2.id, t.id);
    expect(rows.map((r) => r.name)).toEqual(["Alpha", "Bravo"]);
    expect(rows[1].reachedAt).toEqual(new Date("2026-11-04T00:00:00Z"));
  });

  it("at 100% ranks the team that first reached the route length higher, despite fewer extra points", async () => {
    const [org, u1, u2] = await Promise.all(["org", "u1", "u2"].map(user));
    const { t, teams } = await tournament(org.id, ["Alpha", "Bravo"]);
    const [alpha, bravo] = teams;
    await join(t.id, alpha.id, u1.id);
    await join(t.id, bravo.id, u2.id);
    // Alpha finishes on day 5 and goes far beyond; Bravo crosses 1000 points on day 4.
    await entry(t.id, alpha.id, u1.id, 900, "2026-11-01T00:00:00Z");
    await entry(t.id, alpha.id, u1.id, 2000, "2026-11-05T00:00:00Z");
    await entry(t.id, bravo.id, u2.id, 600, "2026-11-02T00:00:00Z");
    await entry(t.id, bravo.id, u2.id, 500, "2026-11-04T00:00:00Z");
    await entry(t.id, bravo.id, u2.id, 50, "2026-11-06T00:00:00Z");

    const rows = await getProgressLeaderboard(u1.id, t.id);
    expect(
      rows.map((r) => [r.name, r.progressBp, r.routeKmReached, r.reachedAt?.toISOString()]),
    ).toEqual([
      ["Bravo", 10000, 100, "2026-11-04T00:00:00.000Z"],
      ["Alpha", 10000, 100, "2026-11-05T00:00:00.000Z"],
    ]);
    expect(rows[1].isMyTeam).toBe(true);
  });

  it("uses the new time when a finish was reversed and regained", async () => {
    const [org, u1, u2] = await Promise.all(["org", "u1", "u2"].map(user));
    const { t, teams } = await tournament(org.id, ["Alpha", "Bravo"]);
    const [alpha, bravo] = teams;
    await join(t.id, alpha.id, u1.id);
    await join(t.id, bravo.id, u2.id);
    await entry(t.id, alpha.id, u1.id, 1000, "2026-11-01T00:00:00Z");
    await entry(t.id, alpha.id, u1.id, -500, "2026-11-02T00:00:00Z", "REVERSAL");
    await entry(t.id, alpha.id, u1.id, 600, "2026-11-05T00:00:00Z");
    await entry(t.id, bravo.id, u2.id, 1000, "2026-11-03T00:00:00Z");

    const rows = await getProgressLeaderboard(u1.id, t.id);
    expect(rows.map((r) => [r.name, r.reachedAt?.toISOString()])).toEqual([
      ["Bravo", "2026-11-03T00:00:00.000Z"],
      ["Alpha", "2026-11-05T00:00:00.000Z"],
    ]);
  });

  it("counts every entry for the team stored on it, whoever earned it", async () => {
    const [org, u1, u2, gone] = await Promise.all(["org", "u1", "u2", "gone"].map(user));
    const { t, teams } = await tournament(org.id, ["Alpha", "Bravo"]);
    const [alpha, bravo] = teams;
    await join(t.id, alpha.id, gone.id, "LEFT");
    await join(t.id, alpha.id, u1.id);
    await join(t.id, bravo.id, u2.id);
    await entry(t.id, alpha.id, gone.id, 300, "2026-11-01T00:00:00Z"); // gone is no longer active
    await entry(t.id, alpha.id, u2.id, 200, "2026-11-01T00:00:00Z"); // stored on Alpha
    await entry(t.id, alpha.id, u1.id, 100, "2026-11-02T00:00:00Z");
    await entry(t.id, bravo.id, u2.id, 150, "2026-11-03T00:00:00Z");
    const other = await tournament(org.id, ["Other"]);
    await entry(other.t.id, other.teams[0].id, u2.id, 900, "2026-11-01T00:00:00Z");

    const rows = await getProgressLeaderboard(u1.id, t.id);
    expect(rows.map((r) => [r.name, r.progressBp, r.reachedAt])).toEqual([
      ["Alpha", 6000, new Date("2026-11-02T00:00:00Z")],
      ["Bravo", 1500, new Date("2026-11-03T00:00:00Z")],
    ]);
  });

  it("refuses a viewer outside the tournament, a left member and an unknown tournament", async () => {
    const [org, outsider, left] = await Promise.all(["org", "outsider", "left"].map(user));
    const { t, teams } = await tournament(org.id, ["Alpha"]);
    await join(t.id, teams[0].id, left.id, "LEFT");
    for (const [viewer, id] of [
      [outsider.id, t.id],
      [left.id, t.id],
      [org.id, "missing"],
    ]) {
      const err = await getProgressLeaderboard(viewer, id).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LeaderboardError);
      expect((err as LeaderboardError).code).toBe("FORBIDDEN");
    }
    expect(await getProgressLeaderboard(org.id, t.id)).toHaveLength(1);
  });
});
