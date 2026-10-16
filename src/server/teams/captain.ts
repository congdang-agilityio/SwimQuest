import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import {
  ForbiddenError,
  NotFoundError,
  requireCaptain,
  requireOrganizer,
} from "@/server/auth/roles";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";

/** The chosen user is not an active member of the team. */
export class NotAMemberError extends Error {
  readonly status = 422;
  readonly code = "NOT_A_MEMBER";
}

export type AppointCaptainResult = { changed: boolean; captainUserId: string };

/**
 * The organizer makes an active member the team's captain, replacing any previous captain
 * (story S-08, FR-76; the role is scoped to this team, FR-09). Throws the role errors of
 * `requireOrganizer` and NotAMemberError. The team row is locked and the membership re-checked
 * inside the transaction; the change and its `TEAM_CAPTAIN_SET` audit event commit together.
 * Appointing the current captain again writes nothing and returns `changed: false`.
 */
export async function appointCaptain(
  organizerId: string,
  teamId: string,
  memberUserId: string,
): Promise<AppointCaptainResult> {
  const team =
    typeof teamId === "string" && teamId.length > 0
      ? await db.team.findUnique({ where: { id: teamId }, select: { tournamentId: true } })
      : null;
  if (!team) throw new NotFoundError();
  const { id: tournamentId } = await requireOrganizer(organizerId, team.tournamentId);
  if (typeof memberUserId !== "string" || memberUserId.length === 0) throw new NotAMemberError();

  return db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ captainUserId: string | null }[]>`
      SELECT "captainUserId" FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
    if (!locked) throw new NotFoundError();
    const member = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "TeamMember"
      WHERE "teamId" = ${teamId} AND "userId" = ${memberUserId} AND "status" = 'ACTIVE'
      FOR SHARE`;
    if (member.length === 0) throw new NotAMemberError();
    if (locked.captainUserId === memberUserId) {
      return { changed: false, captainUserId: memberUserId };
    }

    await tx.team.update({ where: { id: teamId }, data: { captainUserId: memberUserId } });
    const ids = { teamId, tournamentId };
    await recordAudit(tx, {
      actor: { type: "USER", userId: organizerId },
      action: AUDIT_ACTIONS.TEAM_CAPTAIN_SET,
      entityType: "Team",
      entityId: teamId,
      tournamentId,
      before: { ...ids, captainUserId: locked.captainUserId },
      after: { ...ids, captainUserId: memberUserId },
    });
    await emitEvent(tx, {
      type: "TEAM_CAPTAIN_SET",
      payload: { tournamentId, teamId, userId: memberUserId, setBy: organizerId },
    });
    return { changed: true, captainUserId: memberUserId };
  });
}

/**
 * The captain makes another active member captain (story S-40). Throws the errors of
 * `requireCaptain` and NotAMemberError; the change, audit and event commit together.
 */
export async function handOverCaptaincy(
  captainId: string,
  teamId: string,
  memberUserId: string,
): Promise<void> {
  const { tournamentId } = await requireCaptain(captainId, teamId);
  if (typeof memberUserId !== "string" || memberUserId.length === 0 || memberUserId === captainId) {
    throw new NotAMemberError();
  }

  return db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ captainUserId: string | null }[]>`
      SELECT "captainUserId" FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
    if (!locked) throw new NotFoundError();
    if (locked.captainUserId !== captainId) throw new ForbiddenError();
    const member = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "TeamMember"
      WHERE "teamId" = ${teamId} AND "userId" = ${memberUserId} AND "status" = 'ACTIVE'
      FOR SHARE`;
    if (member.length === 0) throw new NotAMemberError();

    await tx.team.update({ where: { id: teamId }, data: { captainUserId: memberUserId } });
    const ids = { teamId, tournamentId };
    await recordAudit(tx, {
      actor: { type: "USER", userId: captainId },
      action: AUDIT_ACTIONS.TEAM_CAPTAIN_HANDOVER,
      entityType: "Team",
      entityId: teamId,
      tournamentId,
      before: { ...ids, captainUserId: captainId },
      after: { ...ids, captainUserId: memberUserId },
    });
    await emitEvent(tx, {
      type: "TEAM_CAPTAIN_SET",
      payload: { tournamentId, teamId, userId: memberUserId, setBy: captainId },
    });
  });
}
