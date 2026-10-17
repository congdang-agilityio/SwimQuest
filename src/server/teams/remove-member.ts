import { effectiveStatus, type LifecycleTournament } from "@/lib/tournaments/lifecycle";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { ArchivedError, ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { NotAMemberError } from "./captain";

export type RemoveEndReason = "REMOVED_BEFORE_START" | "REMOVED_AFTER_START";
export type RemoveMemberResult = { endReason: RemoveEndReason; captainCleared: boolean };

type LockedTeam = {
  tournamentId: string;
  captainUserId: string | null;
  organizerId: string;
  archived: boolean;
};

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * The team's captain or the tournament's organizer removes an active member (story S-41,
 * FR-35, BR-37). Before the start (`effectiveStatus` DRAFT or PUBLISHED) the player stays in
 * the tournament without a team (`REMOVED_BEFORE_START`); from the start on they leave the
 * tournament (`REMOVED_AFTER_START`, which blocks rejoining through the link). Points entries
 * keep their `teamId`, so the team's points and progress do not change. Removing the captain
 * clears the captain. The team row is locked and the roles re-checked inside the transaction;
 * the change, its `TEAM_MEMBER_REMOVED` audit event and domain event commit together.
 * Throws NotFoundError (unknown team), ForbiddenError (not captain or organizer, or removing
 * oneself) and NotAMemberError (the user is not an active member of the team).
 */
export async function removeMember(
  actorId: string,
  teamId: string,
  userId: string,
  now: Date = new Date(),
): Promise<RemoveMemberResult> {
  if (!isId(teamId)) throw new NotFoundError();
  if (!isId(actorId) || actorId === userId) throw new ForbiddenError();
  if (!isId(userId)) throw new NotAMemberError();

  return db.$transaction(async (tx) => {
    const [team] = await tx.$queryRaw<LockedTeam[]>`
      SELECT t."tournamentId", t."captainUserId", o."organizerId", (o."status" = 'ARCHIVED') AS "archived"
      FROM "Team" t JOIN "Tournament" o ON o."id" = t."tournamentId"
      WHERE t."id" = ${teamId} FOR UPDATE OF t`;
    if (!team) throw new NotFoundError();
    const { tournamentId } = team;
    const isCaptain =
      team.captainUserId === actorId &&
      (await tx.teamMember.count({ where: { teamId, userId: actorId, status: "ACTIVE" } })) > 0;
    if (team.organizerId !== actorId && !isCaptain) throw new ForbiddenError();
    if (team.archived) throw new ArchivedError();

    const membership = await tx.teamMember.findFirst({
      where: { teamId, userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) throw new NotAMemberError();

    const [lifecycle] = await tx.$queryRaw<LifecycleTournament[]>`
      SELECT "status"::text, "seasonStartAt", "seasonEndAt", "startChoiceDeadlineAt"
      FROM "Tournament" WHERE "id" = ${tournamentId} FOR SHARE`;
    const status = effectiveStatus(lifecycle, now);
    const afterStart = status !== "DRAFT" && status !== "PUBLISHED";
    const endReason: RemoveEndReason = afterStart ? "REMOVED_AFTER_START" : "REMOVED_BEFORE_START";

    await tx.teamMember.update({
      where: { id: membership.id },
      data: { status: "REMOVED", endedAt: now, endReason },
    });
    const captainCleared = team.captainUserId === userId;
    if (captainCleared) {
      await tx.team.update({ where: { id: teamId }, data: { captainUserId: null } });
    }

    const ids = { teamId, userId };
    await recordAudit(tx, {
      actor: { type: "USER", userId: actorId },
      action: AUDIT_ACTIONS.TEAM_MEMBER_REMOVED,
      entityType: "TeamMember",
      entityId: membership.id,
      tournamentId,
      before: { ...ids, status: "ACTIVE", wasCaptain: captainCleared },
      after: { ...ids, status: "REMOVED", endReason, endedAt: now.toISOString(), afterStart },
    });
    await emitEvent(tx, {
      type: "TEAM_MEMBER_REMOVED",
      payload: { tournamentId, teamId, userId, removedBy: actorId },
    });
    return { endReason, captainCleared };
  });
}
