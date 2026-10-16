import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/server/audit/record";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { isRemovedFromTournament } from "@/server/join/join-view";
import { getTeamPoints } from "@/server/scoring/team-points";
import { NotAMemberError } from "./captain";
import { removeMember } from "./remove-member";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const SEASON_START = new Date("2026-11-01T00:00:00+07:00");
const BEFORE_START = new Date("2026-10-20T00:00:00+07:00");
const DURING_SEASON = new Date("2026-11-10T00:00:00+07:00");

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function setup() {
  const organizer = await user("organizer");
  const captain = await user("captain");
  const member = await user("member");
  const other = await user("other");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status: "PUBLISHED",
      name: "Cup",
      description: "d",
      seasonStartAt: SEASON_START,
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
      memberLimit: 5,
      captainUserId: captain.id,
    },
  });
  for (const u of [captain, member, other]) {
    await db.teamMember.create({
      data: { teamId: team.id, tournamentId: tournament.id, userId: u.id },
    });
  }
  return { organizer, captain, member, other, tournament, team };
}

const membershipOf = (teamId: string, userId: string) =>
  db.teamMember.findFirstOrThrow({ where: { teamId, userId } });

describe("removeMember (S-41)", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("before the start: the player stays in the tournament without a team", async () => {
    const { captain, member, tournament, team } = await setup();

    const result = await removeMember(captain.id, team.id, member.id, BEFORE_START);

    expect(result).toEqual({ endReason: "REMOVED_BEFORE_START", captainCleared: false });
    const row = await membershipOf(team.id, member.id);
    expect(row).toMatchObject({
      status: "REMOVED",
      endReason: "REMOVED_BEFORE_START",
      endedAt: BEFORE_START,
    });
    expect(await db.teamMember.count({ where: { userId: member.id, status: "ACTIVE" } })).toBe(0);
    // Not blocked from choosing another team through the link.
    expect(await isRemovedFromTournament(member.id, tournament.id)).toBe(false);
  });

  it("after the start: the player leaves the tournament and the team keeps its points", async () => {
    const { organizer, member, captain, tournament, team } = await setup();
    const entry = (userId: string, points: number) =>
      db.pointsEntry.create({
        data: {
          tournamentId: tournament.id,
          teamId: team.id,
          userId,
          kind: "DISTANCE",
          points,
          countedM: points * 10,
          vnDay: "2026-11-05",
        },
      });
    await entry(member.id, 120);
    await entry(captain.id, 30);
    const before = await getTeamPoints(tournament.id, team.id);

    const result = await removeMember(organizer.id, team.id, member.id, DURING_SEASON);

    expect(result.endReason).toBe("REMOVED_AFTER_START");
    expect(await membershipOf(team.id, member.id)).toMatchObject({
      status: "REMOVED",
      endReason: "REMOVED_AFTER_START",
      endedAt: DURING_SEASON,
    });
    expect(await getTeamPoints(tournament.id, team.id)).toBe(before);
    expect(before).toBe(150);
    expect(await db.pointsEntry.count({ where: { userId: member.id, teamId: team.id } })).toBe(1);
    expect(await isRemovedFromTournament(member.id, tournament.id)).toBe(true);
  });

  it("refuses a member who is not captain or organizer, and an outsider", async () => {
    const { member, other, team } = await setup();
    const outsider = await user("outsider");

    await expect(removeMember(member.id, team.id, other.id, BEFORE_START)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(removeMember(outsider.id, team.id, other.id, BEFORE_START)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await membershipOf(team.id, other.id)).status).toBe("ACTIVE");
    expect(await db.auditEvent.count()).toBe(0);
    expect(await db.domainEvent.count()).toBe(0);
  });

  it("refuses a captain removing themselves", async () => {
    const { captain, team } = await setup();

    await expect(
      removeMember(captain.id, team.id, captain.id, BEFORE_START),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await membershipOf(team.id, captain.id)).status).toBe("ACTIVE");
    expect((await db.team.findUniqueOrThrow({ where: { id: team.id } })).captainUserId).toBe(
      captain.id,
    );
  });

  it("refuses a captain of a team who is no longer an active member", async () => {
    const { captain, member, team } = await setup();
    await db.teamMember.updateMany({
      where: { userId: captain.id },
      data: { status: "LEFT", endReason: "LEFT", endedAt: BEFORE_START },
    });

    await expect(removeMember(captain.id, team.id, member.id, BEFORE_START)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("clears the captain when the organizer removes the captain", async () => {
    const { organizer, captain, team } = await setup();

    const result = await removeMember(organizer.id, team.id, captain.id, BEFORE_START);

    expect(result).toEqual({ endReason: "REMOVED_BEFORE_START", captainCleared: true });
    expect((await db.team.findUniqueOrThrow({ where: { id: team.id } })).captainUserId).toBeNull();
  });

  it("records who removed whom and when, and emits TEAM_MEMBER_REMOVED", async () => {
    const { captain, member, tournament, team } = await setup();

    await removeMember(captain.id, team.id, member.id, DURING_SEASON);

    const membership = await membershipOf(team.id, member.id);
    const audits = await db.auditEvent.findMany();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorType: "USER",
      actorUserId: captain.id,
      action: AUDIT_ACTIONS.TEAM_MEMBER_REMOVED,
      entityType: "TeamMember",
      entityId: membership.id,
      tournamentId: tournament.id,
      before: { teamId: team.id, userId: member.id, status: "ACTIVE" },
      after: {
        teamId: team.id,
        userId: member.id,
        status: "REMOVED",
        endReason: "REMOVED_AFTER_START",
        endedAt: DURING_SEASON.toISOString(),
        afterStart: true,
      },
    });
    const events = await db.domainEvent.findMany({ where: { type: "TEAM_MEMBER_REMOVED" } });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({
      tournamentId: tournament.id,
      teamId: team.id,
      userId: member.id,
      removedBy: captain.id,
    });
  });

  it("rejects an unknown team and a user who is not an active member", async () => {
    const { organizer, team, member } = await setup();
    const stranger = await user("stranger");

    await expect(
      removeMember(organizer.id, "missing", member.id, BEFORE_START),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      removeMember(organizer.id, team.id, stranger.id, BEFORE_START),
    ).rejects.toBeInstanceOf(NotAMemberError);
    await removeMember(organizer.id, team.id, member.id, BEFORE_START);
    await expect(
      removeMember(organizer.id, team.id, member.id, BEFORE_START),
    ).rejects.toBeInstanceOf(NotAMemberError);
  });
});
