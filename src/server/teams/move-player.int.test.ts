import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/server/audit/record";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { getTeamPoints } from "@/server/scoring/team-points";
import { NotAMemberError } from "./captain";
import { InvalidMoveError, movePlayer, TeamFullError } from "./move-player";

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.weeklyResult.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const NOW = new Date("2026-06-10T09:00:00+07:00");
const FINISHED_AT = new Date("2026-06-05T09:00:00+07:00");

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

/** An active tournament with a 10 km route (finish at 100 team points). */
async function tournament(organizerId: string, name = "Race") {
  return db.tournament.create({
    data: {
      organizerId,
      name,
      description: "d",
      status: "PUBLISHED",
      seasonStartAt: new Date("2026-05-01T06:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 10000,
    },
  });
}

async function team(tournamentId: string, name: string, userIds: string[], memberLimit = 3) {
  const t = await db.team.create({
    data: { tournamentId, name, emblemKey: "dolphin", memberLimit },
  });
  for (const userId of userIds) {
    await db.teamMember.create({ data: { tournamentId, teamId: t.id, userId } });
  }
  return t;
}

let sha = 0;
/** A verified swim result of `userId` for `teamId` with `points` distance points. */
async function verifiedSwim(tournamentId: string, teamId: string, userId: string, points: number) {
  const startedAt = new Date("2026-06-01T06:00:00+07:00");
  const swim = await db.swim.create({
    data: {
      userId,
      source: "FIT",
      fileSha256: (++sha).toString(16).padStart(64, "0"),
      originalFilename: "swim.fit",
      startedAt,
      endedAt: new Date(startedAt.getTime() + 1800_000),
      distanceM: points * 100,
      durationS: 1800,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
    },
  });
  const result = await db.swimResult.create({
    data: { swimId: swim.id, tournamentId, teamId, userId, status: "VERIFIED", reasons: [] },
  });
  await db.pointsEntry.create({
    data: {
      tournamentId,
      teamId,
      userId,
      swimResultId: result.id,
      kind: "DISTANCE",
      points,
      vnDay: "2026-06-01",
    },
  });
  return result;
}

/**
 * Alpha (finished, 110 points): the mover (captain, 60 points incl. a 10-point weekly
 * multiplier) and a2 (50). Bravo (20 points): b1. The mover also plays another tournament.
 */
async function setup(bravoLimit = 3) {
  const organizer = await user("organizer");
  const mover = await user("mover");
  const a2 = await user("a2");
  const b1 = await user("b1");
  const t = await tournament(organizer.id);
  const alpha = await team(t.id, "Alpha", [mover.id, a2.id]);
  const bravo = await team(t.id, "Bravo", [b1.id], bravoLimit);
  await db.team.update({
    where: { id: alpha.id },
    data: { captainUserId: mover.id, progressBp: 10000, finishedAt: FINISHED_AT },
  });
  await db.team.update({ where: { id: bravo.id }, data: { progressBp: 2000 } });
  const result = await verifiedSwim(t.id, alpha.id, mover.id, 50);
  await db.weeklyResult.create({
    data: {
      tournamentId: t.id,
      userId: mover.id,
      teamId: alpha.id,
      weekStart: "2026-06-01",
      activeDays: 2,
      multiplierPct: 120,
      distancePoints: 50,
      extraPoints: 10,
      streakWeeks: 0,
      settledAt: FINISHED_AT,
    },
  });
  await db.pointsEntry.create({
    data: {
      tournamentId: t.id,
      teamId: alpha.id,
      userId: mover.id,
      kind: "WEEKLY_MULTIPLIER",
      points: 10,
      vnDay: "2026-06-01",
    },
  });
  await verifiedSwim(t.id, alpha.id, a2.id, 50);
  await verifiedSwim(t.id, bravo.id, b1.id, 20);

  const otherOrg = await user("other-org");
  const other = await tournament(otherOrg.id, "Other");
  const otherTeam = await team(other.id, "Elsewhere", [mover.id]);
  await verifiedSwim(other.id, otherTeam.id, mover.id, 30);
  return { organizer, mover, a2, b1, t, alpha, bravo, result, other, otherTeam };
}

const teamRow = (id: string) => db.team.findUniqueOrThrow({ where: { id } });
const eventsOf = (type: string) =>
  db.domainEvent.findMany({ where: { type }, orderBy: { createdAt: "asc" } });

describe("movePlayer (S-39)", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("moves the player with their points, swims and multipliers to the target team", async () => {
    const s = await setup();

    const moved = await movePlayer(s.organizer.id, s.mover.id, s.alpha.id, s.bravo.id, NOW);

    expect(moved).toEqual({ entriesMoved: 2, captainCleared: true });
    expect(await getTeamPoints(s.t.id, s.alpha.id)).toBe(50);
    expect(await getTeamPoints(s.t.id, s.bravo.id)).toBe(80);
    const memberships = await db.teamMember.findMany({
      where: { userId: s.mover.id, tournamentId: s.t.id },
      orderBy: { joinedAt: "asc" },
    });
    expect(memberships).toHaveLength(2);
    expect(memberships.find((m) => m.teamId === s.alpha.id)).toMatchObject({
      status: "LEFT",
      endReason: "MOVED",
      endedAt: NOW,
    });
    expect(memberships.find((m) => m.teamId === s.bravo.id)).toMatchObject({
      status: "ACTIVE",
      endReason: null,
      endedAt: null,
    });
    expect((await db.swimResult.findUniqueOrThrow({ where: { id: s.result.id } })).teamId).toBe(
      s.bravo.id,
    );
    const weekly = await db.weeklyResult.findFirstOrThrow({ where: { userId: s.mover.id } });
    expect(weekly.teamId).toBe(s.bravo.id);
    // The other tournament is untouched.
    expect(await getTeamPoints(s.other.id, s.otherTeam.id)).toBe(30);
    const elsewhere = await db.teamMember.findFirstOrThrow({ where: { teamId: s.otherTeam.id } });
    expect(elsewhere.status).toBe("ACTIVE");
  });

  it("withdraws the old team's finish and refreshes both teams' progress", async () => {
    const s = await setup();

    await movePlayer(s.organizer.id, s.mover.id, s.alpha.id, s.bravo.id, NOW);

    const alpha = await teamRow(s.alpha.id);
    expect(alpha).toMatchObject({
      progressBp: 5000,
      finishedAt: null,
      finishLostAt: NOW,
      finishLostReason: "PLAYER_MOVED",
    });
    expect((await teamRow(s.bravo.id)).progressBp).toBe(8000);
    const lost = await eventsOf("TEAM_FINISH_LOST");
    expect(lost.map((e) => e.payload)).toEqual([{ tournamentId: s.t.id, teamId: s.alpha.id }]);
  });

  it("clears the captain when the moved player captained the old team", async () => {
    const s = await setup();

    await movePlayer(s.organizer.id, s.mover.id, s.alpha.id, s.bravo.id, NOW);

    expect((await teamRow(s.alpha.id)).captainUserId).toBeNull();
  });

  it("keeps the old team's captain when another player moves", async () => {
    const s = await setup();

    const moved = await movePlayer(s.organizer.id, s.a2.id, s.alpha.id, s.bravo.id, NOW);

    expect(moved.captainCleared).toBe(false);
    expect((await teamRow(s.alpha.id)).captainUserId).toBe(s.mover.id);
  });

  it("refuses a full target team and changes nothing", async () => {
    const s = await setup(1);

    await expect(
      movePlayer(s.organizer.id, s.mover.id, s.alpha.id, s.bravo.id, NOW),
    ).rejects.toBeInstanceOf(TeamFullError);

    expect(await getTeamPoints(s.t.id, s.alpha.id)).toBe(110);
    const active = await db.teamMember.findFirstOrThrow({
      where: { userId: s.mover.id, tournamentId: s.t.id, status: "ACTIVE" },
    });
    expect(active.teamId).toBe(s.alpha.id);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("gives the last place to exactly one of two concurrent moves", async () => {
    const s = await setup(2);

    const outcomes = await Promise.allSettled([
      movePlayer(s.organizer.id, s.mover.id, s.alpha.id, s.bravo.id, NOW),
      movePlayer(s.organizer.id, s.a2.id, s.alpha.id, s.bravo.id, NOW),
    ]);

    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.filter((o) => o.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(TeamFullError);
    expect(await db.teamMember.count({ where: { teamId: s.bravo.id, status: "ACTIVE" } })).toBe(2);
  });

  it("refuses anyone but the tournament's organizer", async () => {
    const s = await setup();

    await expect(
      movePlayer(s.mover.id, s.a2.id, s.alpha.id, s.bravo.id, NOW),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      movePlayer(s.otherTeam.id, s.a2.id, s.alpha.id, s.bravo.id, NOW),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getTeamPoints(s.t.id, s.bravo.id)).toBe(20);
  });

  it("refuses unknown teams, a target in another tournament, the same team and non-members", async () => {
    const s = await setup();
    const org = s.organizer.id;

    await expect(movePlayer(org, s.mover.id, "nope", s.bravo.id, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(movePlayer(org, s.mover.id, s.alpha.id, "nope", NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      movePlayer(org, s.mover.id, s.alpha.id, s.otherTeam.id, NOW),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(movePlayer(org, s.mover.id, s.alpha.id, s.alpha.id, NOW)).rejects.toBeInstanceOf(
      InvalidMoveError,
    );
    await expect(movePlayer(org, s.b1.id, s.alpha.id, s.bravo.id, NOW)).rejects.toBeInstanceOf(
      NotAMemberError,
    );
  });

  it("records the move in the audit trail and emits TEAM_MEMBER_MOVED", async () => {
    const s = await setup();

    await movePlayer(s.organizer.id, s.mover.id, s.alpha.id, s.bravo.id, NOW);

    const audits = await db.auditEvent.findMany();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: AUDIT_ACTIONS.PLAYER_MOVED,
      actorType: "USER",
      actorUserId: s.organizer.id,
      entityType: "TeamMember",
      tournamentId: s.t.id,
      before: { userId: s.mover.id, teamId: s.alpha.id, wasCaptain: true },
      after: {
        userId: s.mover.id,
        teamId: s.bravo.id,
        fromTeamId: s.alpha.id,
        movedAt: NOW.toISOString(),
        entriesMoved: 2,
      },
    });
    const moved = await eventsOf("TEAM_MEMBER_MOVED");
    expect(moved.map((e) => e.payload)).toEqual([
      { tournamentId: s.t.id, teamId: s.bravo.id, userId: s.mover.id, fromTeamId: s.alpha.id },
    ]);
  });
});
