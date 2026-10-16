import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getCurrentMembership, listMyTournaments } from "./my-tournaments";

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

async function tournament(
  organizerId: string,
  name: string,
  status: "DRAFT" | "PUBLISHED" = "PUBLISHED",
  startDestination: string | null = "dest01",
) {
  const t = await db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      status,
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000, // 100 km * 10 points/km = 1000 points
    },
  });
  const team = await db.team.create({
    data: {
      tournamentId: t.id,
      name: `${name}-team`,
      emblemKey: "dolphin",
      memberLimit: 5,
      startDestination,
    },
  });
  return { t, team };
}

const join = (tournamentId: string, teamId: string, userId: string, joinedAt: string) =>
  db.teamMember.create({ data: { tournamentId, teamId, userId, joinedAt: new Date(joinedAt) } });

describe("my tournaments", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });
  const now = new Date("2026-11-05T00:00:00Z");

  it("returns nothing for a user in no tournament", async () => {
    const u = await user("lonely");
    expect(await listMyTournaments(u.id, now)).toEqual([]);
    expect(await getCurrentMembership(u.id)).toBeNull();
  });

  it("lists memberships newest first with team, status and progress", async () => {
    const org = await user("org");
    const me = await user("me");
    const one = await tournament(org.id, "One");
    const two = await tournament(org.id, "Two");
    await join(one.t.id, one.team.id, me.id, "2026-10-01T00:00:00Z");
    await join(two.t.id, two.team.id, me.id, "2026-10-02T00:00:00Z");
    await db.pointsEntry.create({
      data: {
        tournamentId: one.t.id,
        teamId: one.team.id,
        userId: me.id,
        kind: "DISTANCE",
        points: 250,
        countedM: 1,
        vnDay: "2026-11-02",
      },
    });
    const list = await listMyTournaments(me.id, now);
    expect(list.map((x) => x.name)).toEqual(["Two", "One"]);
    expect(list[1]).toEqual({
      id: one.t.id,
      name: "One",
      effectiveStatus: "ACTIVE",
      isOrganizer: false,
      team: { id: one.team.id, name: "One-team", emblemKey: "dolphin" },
      progressBp: 2500,
    });
    expect(list[0].progressBp).toBe(0);
    const current = await getCurrentMembership(me.id);
    expect(current?.tournament.id).toBe(two.t.id);
    expect(current?.team.id).toBe(two.team.id);
  });

  it("has no progress for a team without a chosen start, 0 once a start is chosen", async () => {
    const org = await user("org");
    const me = await user("me");
    const none = await tournament(org.id, "NoStart", "PUBLISHED", null);
    const chosen = await tournament(org.id, "Chosen");
    await join(none.t.id, none.team.id, me.id, "2026-10-01T00:00:00Z");
    await join(chosen.t.id, chosen.team.id, me.id, "2026-10-02T00:00:00Z");
    const list = await listMyTournaments(me.id, now);
    expect(list.find((x) => x.name === "NoStart")?.progressBp).toBeNull();
    expect(list.find((x) => x.name === "Chosen")?.progressBp).toBe(0);
  });

  it("ignores left memberships", async () => {
    const org = await user("org");
    const me = await user("me");
    const one = await tournament(org.id, "One");
    await db.teamMember.create({
      data: { tournamentId: one.t.id, teamId: one.team.id, userId: me.id, status: "LEFT" },
    });
    expect(await listMyTournaments(me.id, now)).toEqual([]);
    expect(await getCurrentMembership(me.id)).toBeNull();
  });

  it("shows a draft to its organizer only", async () => {
    const org = await user("org");
    const other = await user("other");
    const draft = await tournament(org.id, "Draft", "DRAFT");
    await join(draft.t.id, draft.team.id, other.id, "2026-10-01T00:00:00Z");
    const mine = await listMyTournaments(org.id, now);
    expect(mine).toEqual([
      {
        id: draft.t.id,
        name: "Draft",
        effectiveStatus: "DRAFT",
        isOrganizer: true,
        team: null,
        progressBp: null,
      },
    ]);
    expect(await listMyTournaments(other.id, now)).toEqual([]);
  });
});
