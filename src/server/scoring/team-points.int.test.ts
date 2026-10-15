import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getPlayerTotals, getTeamPoints, getTeamsPoints } from "./team-points";

async function clean() {
  await db.pointsEntry.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.user.deleteMany();
}

async function tournament(organizerId: string, name: string) {
  const t = await db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 1650000,
    },
  });
  const mk = (n: string) =>
    db.team.create({
      data: { tournamentId: t.id, name: n, emblemKey: "dolphin", memberLimit: 5 },
    });
  return { t, a: await mk("A"), b: await mk("B") };
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

function entry(tournamentId: string, teamId: string, userId: string, points: number, m = 0) {
  return db.pointsEntry.create({
    data: {
      tournamentId,
      teamId,
      userId,
      kind: "DISTANCE",
      points,
      countedM: m,
      vnDay: "2026-11-02",
    },
  });
}

describe("player and team points", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  async function scenario() {
    const [org, u1, u2, u3, u4] = await Promise.all(["org", "u1", "u2", "u3", "u4"].map(user));
    const { t, a, b } = await tournament(org.id, "T1");
    const other = await tournament(org.id, "T2");
    for (const [team, u] of [
      [a, u1],
      [a, u2],
      [b, u3],
    ] as const) {
      await db.teamMember.create({ data: { teamId: team.id, tournamentId: t.id, userId: u.id } });
    }
    await db.teamMember.create({ data: { teamId: b.id, tournamentId: t.id, userId: u4.id } });
    await entry(t.id, a.id, u1.id, 100, 1000);
    await entry(t.id, a.id, u1.id, 50, 500);
    await entry(t.id, a.id, u2.id, 30, 300);
    await entry(t.id, b.id, u3.id, 70, 700);
    await entry(other.t.id, other.a.id, u1.id, 999, 9999);
    return { t, a, b, u1, u2, u3, u4 };
  }

  it("sums points and metres per user in the tournament only; none counts as 0", async () => {
    const { t, u1, u2, u4 } = await scenario();
    const totals = await getPlayerTotals(t.id, [u1.id, u2.id, u4.id]);
    expect(totals.get(u1.id)).toEqual({ points: 150, countedM: 1500 });
    expect(totals.get(u2.id)).toEqual({ points: 30, countedM: 300 });
    expect(totals.get(u4.id)).toEqual({ points: 0, countedM: 0 });
    expect(await getPlayerTotals(t.id, [])).toEqual(new Map());
  });

  it("team points are the sum of current active members, other tournaments excluded", async () => {
    const { t, a, b } = await scenario();
    expect(await getTeamsPoints(t.id)).toEqual(
      new Map([
        [a.id, 180],
        [b.id, 70],
      ]),
    );
    expect(await getTeamPoints(t.id, a.id)).toBe(180);
    expect(await getTeamPoints(t.id, "missing")).toBe(0);
  });

  it("points follow the member after a move, and left members stop counting", async () => {
    const { t, a, b, u1, u2 } = await scenario();
    await db.teamMember.updateMany({ where: { userId: u1.id }, data: { status: "LEFT" } });
    await db.teamMember.create({ data: { teamId: b.id, tournamentId: t.id, userId: u1.id } });
    await db.teamMember.updateMany({ where: { userId: u2.id }, data: { status: "REMOVED" } });
    expect(await getTeamPoints(t.id, a.id)).toBe(0);
    expect(await getTeamPoints(t.id, b.id)).toBe(220);
  });
});
