import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getMyTeamView } from "./my-team-view";

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

async function setup() {
  const [org, cap, b, c] = await Promise.all(["org", "cap", "bee", "cee"].map(user));
  const t = await db.tournament.create({
    data: {
      organizerId: org.id,
      name: "Cup",
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({
    data: {
      tournamentId: t.id,
      name: "Otters",
      emblemKey: "dolphin",
      description: "fast",
      memberLimit: 5,
      captainUserId: cap.id,
    },
  });
  const join = (userId: string, joinedAt: string) =>
    db.teamMember.create({
      data: { tournamentId: t.id, teamId: team.id, userId, joinedAt: new Date(joinedAt) },
    });
  await join(cap.id, "2026-10-01T00:00:00Z");
  await join(b.id, "2026-10-02T00:00:00Z");
  await join(c.id, "2026-10-03T00:00:00Z");
  const earn = (userId: string, points: number, countedM: number, day: string) =>
    db.pointsEntry.create({
      data: {
        tournamentId: t.id,
        teamId: team.id,
        userId,
        kind: "DISTANCE",
        points,
        countedM,
        vnDay: day,
      },
    });
  return { t, team, cap, b, c, earn };
}

describe("my team view", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns null with no current team", async () => {
    const u = await user("lonely");
    expect(await getMyTeamView(u.id)).toBeNull();
  });

  it("lists the roster with contributions and sums team points", async () => {
    const { t, team, cap, b, c, earn } = await setup();
    await earn(cap.id, 30, 3000, "2026-11-02");
    await earn(cap.id, 20, 2000, "2026-11-03");
    await earn(b.id, 15, 1500, "2026-11-02");
    const view = await getMyTeamView(b.id);
    expect(view).not.toBeNull();
    expect(view!.tournament.id).toBe(t.id);
    expect(view!.team).toEqual({
      name: "Otters",
      emblemKey: "dolphin",
      description: "fast",
      memberLimit: 5,
    });
    expect(view!.captain).toEqual({
      id: cap.id,
      displayName: "cap",
      avatarImageId: null,
      avatarDefaultKey: null,
    });
    expect(view!.start).toBeNull();
    expect(view!.memberCount).toBe(3);
    expect(view!.roster).toEqual([
      {
        id: cap.id,
        displayName: "cap",
        avatarImageId: null,
        avatarDefaultKey: null,
        verifiedKm: 5,
        points: 50,
        isCaptain: true,
        level: 1,
      },
      {
        id: b.id,
        displayName: "bee",
        avatarImageId: null,
        avatarDefaultKey: null,
        verifiedKm: 1.5,
        points: 15,
        isCaptain: false,
        level: 1,
      },
      {
        id: c.id,
        displayName: "cee",
        avatarImageId: null,
        avatarDefaultKey: null,
        verifiedKm: 0,
        points: 0,
        isCaptain: false,
        level: 1,
      },
    ]);
    expect(view!.teamPoints).toBe(65);
    expect(view!.teamPoints).toBe(view!.roster.reduce((s, m) => s + m.points, 0));
    expect(view!.progress.progressBp).toBe(Math.floor((65 * 1000 * 10000) / (100000 * 10)));
    expect(team.id).toBeTruthy();
  });

  it("shows each member's level from their XP", async () => {
    const { cap, b } = await setup();
    await db.xpEntry.create({ data: { userId: b.id, kind: "DISTANCE", xp: 150 } });
    const view = await getMyTeamView(cap.id);
    expect(view!.roster.map((m) => m.level)).toEqual([1, 3, 1]);
  });

  it("returns the team's finishedAt, null while unfinished", async () => {
    const { team, cap } = await setup();
    expect((await getMyTeamView(cap.id))!.finishedAt).toBeNull();
    const at = new Date("2026-11-20T08:00:00Z");
    await db.team.update({ where: { id: team.id }, data: { finishedAt: at } });
    expect((await getMyTeamView(cap.id))!.finishedAt).toEqual(at);
  });

  it("reports the chosen start", async () => {
    const { team, b } = await setup();
    await db.team.update({
      where: { id: team.id },
      data: {
        startDestination: "x",
        startSetAt: new Date("2026-10-05T00:00:00Z"),
        startSetBy: "CAPTAIN",
      },
    });
    const view = await getMyTeamView(b.id);
    expect(view!.start).toEqual({
      slug: "x",
      setBy: "CAPTAIN",
      setAt: new Date("2026-10-05T00:00:00Z"),
    });
  });

  it("leaves out members who left and never exposes an email", async () => {
    const { t, b, c, cap } = await setup();
    await db.teamMember.updateMany({
      where: { tournamentId: t.id, userId: c.id },
      data: { status: "LEFT" },
    });
    const view = await getMyTeamView(b.id);
    expect(view!.memberCount).toBe(2);
    expect(view!.roster.map((m) => m.id)).toEqual([cap.id, b.id]);
    expect(JSON.stringify(view)).not.toContain("@example.com");
  });
});
