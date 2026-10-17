import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { ArchivedError, ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { lockPlayerSwims } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { updateTeamProgress } from "@/server/progress/update-team-progress";
import { lockPlayerPoints } from "@/server/scoring/award-distance-points";
import { NotAMemberError } from "./captain";

/** The target team has no room (its active members reached `memberLimit`). */
export class TeamFullError extends Error {
  readonly status = 409;
  readonly code = "TEAM_FULL";
}

/** The source and target team are the same team. */
export class InvalidMoveError extends Error {
  readonly status = 422;
  readonly code = "VALIDATION_FAILED";
}

type LockedTeam = {
  id: string;
  captainUserId: string | null;
  memberLimit: number;
  org: string;
  archived: boolean;
};
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * The organizer moves an active player to a team of the same tournament with room, before or
 * during the season (S-39, FR-75, BR-31): the old membership ends (`LEFT`, `MOVED`), and the
 * points entries, swim results and weekly results the player has with the old team move along.
 * A moved captain is cleared; both teams' progress is refreshed; audited and evented together.
 * Lock order as an upload: `swims:` and `points:` locks, then both team rows by ascending id.
 */
export async function movePlayer(
  organizerId: string,
  userId: string,
  fromTeamId: string,
  toTeamId: string,
  now: Date = new Date(),
): Promise<{ entriesMoved: number; captainCleared: boolean }> {
  if (!isId(fromTeamId) || !isId(toTeamId)) throw new NotFoundError();
  if (fromTeamId === toTeamId) throw new InvalidMoveError();
  if (!isId(userId)) throw new NotAMemberError();
  const tournamentId = (await db.team.findUnique({ where: { id: fromTeamId } }))?.tournamentId;
  if (!tournamentId) throw new NotFoundError();

  return db.$transaction(async (tx) => {
    await lockPlayerSwims(tx, userId);
    await lockPlayerPoints(tx, tournamentId, userId);
    const teams = await tx.$queryRaw<LockedTeam[]>`
      SELECT t."id", t."captainUserId", t."memberLimit", o."organizerId" AS "org", (o."status" = 'ARCHIVED') AS "archived"
      FROM "Team" t JOIN "Tournament" o ON o."id" = t."tournamentId"
      WHERE t."id" IN (${fromTeamId}, ${toTeamId}) AND t."tournamentId" = ${tournamentId}
      ORDER BY t."id" FOR NO KEY UPDATE OF t`;
    const old = teams.find((t) => t.id === fromTeamId);
    const target = teams.find((t) => t.id === toTeamId);
    if (!old) throw new NotFoundError();
    if (old.org !== organizerId) throw new ForbiddenError();
    if (old.archived) throw new ArchivedError();
    if (!target) throw new NotFoundError();
    const member = await tx.teamMember.findFirst({
      where: { teamId: fromTeamId, userId, status: "ACTIVE" },
    });
    if (!member) throw new NotAMemberError();
    const members = await tx.teamMember.count({ where: { teamId: toTeamId, status: "ACTIVE" } });
    if (members >= target.memberLimit) throw new TeamFullError();

    // Conditional on the row still being ACTIVE in the old team: if anything ended it after the
    // read above, the move rolls back instead of reporting success for a move that did not happen.
    const { count: ended } = await tx.teamMember.updateMany({
      where: { id: member.id, teamId: fromTeamId, status: "ACTIVE" },
      data: { status: "LEFT", endReason: "MOVED", endedAt: now },
    });
    if (ended !== 1) throw new NotAMemberError();
    const joined = await tx.teamMember.create({
      data: { teamId: toTeamId, tournamentId, userId, joinedAt: now },
    });
    const move = {
      where: { tournamentId, userId, teamId: fromTeamId },
      data: { teamId: toTeamId },
    };
    const { count: entriesMoved } = await tx.pointsEntry.updateMany(move);
    await tx.swimResult.updateMany(move);
    await tx.weeklyResult.updateMany(move);
    const captainCleared = old.captainUserId === userId;
    if (captainCleared) {
      await tx.team.update({ where: { id: fromTeamId }, data: { captainUserId: null } });
    }
    for (const teamId of [fromTeamId, toTeamId].sort()) {
      await updateTeamProgress(tx, tournamentId, teamId, now, "PLAYER_MOVED");
    }

    await recordAudit(tx, {
      actor: { type: "USER", userId: organizerId },
      action: AUDIT_ACTIONS.PLAYER_MOVED,
      entityType: "TeamMember",
      entityId: joined.id,
      tournamentId,
      before: { userId, teamId: fromTeamId, membershipId: member.id, wasCaptain: captainCleared },
      after: { userId, teamId: toTeamId, fromTeamId, movedAt: now.toISOString(), entriesMoved },
    });
    const payload = { tournamentId, teamId: toTeamId, userId, fromTeamId };
    await emitEvent(tx, { type: "TEAM_MEMBER_MOVED", payload });
    return { entriesMoved, captainCleared };
  });
}
