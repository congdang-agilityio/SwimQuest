import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { updateTeam } from "./manage";
import { updateTeamDetails } from "./team-details";

async function clean() {
  await db.auditEvent.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function setup() {
  const organizer = await user("organizer");
  const captain = await user("captain");
  const member = await user("member");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Sharks",
      emblemKey: "dolphin",
      description: "Fast",
      memberLimit: 5,
      captainUserId: captain.id,
    },
  });
  for (const u of [captain, member]) {
    await db.teamMember.create({
      data: { teamId: team.id, tournamentId: tournament.id, userId: u.id },
    });
  }
  return { organizer, captain, member, tournament, team };
}

const edit = { name: "Whales", emblemKey: "wave", description: "Big" };

describe("updateTeamDetails", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("lets the captain change name, emblem and description and audits the change", async () => {
    const { captain, team, tournament } = await setup();
    const result = await updateTeamDetails(captain.id, team.id, edit);
    expect(result).toMatchObject({ ok: true, team: { ...edit, memberLimit: 5 } });
    const rows = await db.auditEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorType: "USER",
      actorUserId: captain.id,
      action: "TEAM_DETAILS_UPDATED",
      entityType: "Team",
      entityId: team.id,
      tournamentId: tournament.id,
      before: { name: "Sharks", emblemKey: "dolphin", description: "Fast" },
      after: edit,
    });
  });

  it("records only the changed fields", async () => {
    const { captain, team } = await setup();
    await updateTeamDetails(captain.id, team.id, {
      ...edit,
      emblemKey: "dolphin",
      description: "Fast",
    });
    const [row] = await db.auditEvent.findMany();
    expect(row.before).toEqual({ name: "Sharks" });
    expect(row.after).toEqual({ name: "Whales" });
  });

  it("writes no audit row when nothing changed", async () => {
    const { captain, team } = await setup();
    await updateTeamDetails(captain.id, team.id, {
      name: "Sharks",
      emblemKey: "dolphin",
      description: "Fast",
    });
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("refuses a captain who sends memberLimit and changes nothing", async () => {
    const { captain, team } = await setup();
    await expect(
      updateTeamDetails(captain.id, team.id, { ...edit, memberLimit: 9 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.team.findUniqueOrThrow({ where: { id: team.id } })).toMatchObject({
      name: "Sharks",
      memberLimit: 5,
    });
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("lets the organizer override the captain's name without touching the limit", async () => {
    const { captain, organizer, team } = await setup();
    await updateTeamDetails(captain.id, team.id, edit);
    const result = await updateTeamDetails(organizer.id, team.id, { ...edit, name: "Orcas" });
    expect(result).toMatchObject({ ok: true, team: { name: "Orcas", memberLimit: 5 } });
    const rows = await db.auditEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.actorUserId).sort()).toEqual([captain.id, organizer.id].sort());
  });

  it("refuses a plain member and an outsider, and an unknown team", async () => {
    const { member, team } = await setup();
    const outsider = await user("outsider");
    for (const u of [member, outsider]) {
      await expect(updateTeamDetails(u.id, team.id, edit)).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(updateTeamDetails(member.id, "nope", edit)).rejects.toBeInstanceOf(NotFoundError);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("returns field errors for invalid input", async () => {
    const { captain, team } = await setup();
    expect(await updateTeamDetails(captain.id, team.id, { ...edit, name: " " })).toEqual({
      ok: false,
      errors: { name: "NAME_REQUIRED" },
    });
  });

  it("audits the organizer's updateTeam including the limit", async () => {
    const { organizer, team } = await setup();
    await updateTeam(organizer.id, team.id, { ...edit, memberLimit: 8 });
    const [row] = await db.auditEvent.findMany();
    expect(row).toMatchObject({
      action: "TEAM_DETAILS_UPDATED",
      actorUserId: organizer.id,
      before: { name: "Sharks", emblemKey: "dolphin", description: "Fast", memberLimit: 5 },
      after: { ...edit, memberLimit: 8 },
    });
  });
});
