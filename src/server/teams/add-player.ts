import { Prisma } from "@prisma/client";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { ArchivedError, ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { lockPlayerSwims } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { NotAMemberError } from "./captain";
import { TeamFullError } from "./move-player";

/** The player already has an active team in the tournament. */
export class AlreadyMemberError extends Error {
  readonly status = 409;
  readonly code = "ALREADY_MEMBER";
}

type LockedTeam = {
  tournamentId: string;
  memberLimit: number;
  organizerId: string;
  archived: boolean;
};
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * The organizer puts a tournament player without a team into a team with room, before or during
 * the season (story S-42, FR-75, Q-53). The player must already be in the tournament (an ended
 * membership: left, removed before or after the start); new people join by link. The new ACTIVE
 * membership becomes the player's latest, which lifts the link-join block of a removal after the
 * start (`isRemovedFromTournament`); if they later leave on their own, the block stays lifted,
 * since the organizer re-admitted them. Swim results are made at upload time from active
 * memberships only, so swims uploaded while removed keep no result here, and later ones count.
 * Lock order as an upload: the player's `swims:` lock, then the team row (`FOR UPDATE`), so
 * concurrent adds to the last place serialize and one gets `TEAM_FULL`. Audited and evented
 * in the same transaction. Throws NotFoundError, ForbiddenError, NotAMemberError (not a player
 * of the tournament), AlreadyMemberError and TeamFullError.
 */
export async function addPlayerToTeam(
  organizerId: string,
  teamId: string,
  userId: string,
  now: Date = new Date(),
): Promise<{ membershipId: string; tournamentId: string }> {
  if (!isId(teamId)) throw new NotFoundError();
  if (!isId(organizerId)) throw new ForbiddenError();
  if (!isId(userId)) throw new NotAMemberError();

  try {
    return await db.$transaction(async (tx) => {
      await lockPlayerSwims(tx, userId);
      const [team] = await tx.$queryRaw<LockedTeam[]>`
        SELECT t."tournamentId", t."memberLimit", o."organizerId", (o."status" = 'ARCHIVED') AS "archived"
        FROM "Team" t JOIN "Tournament" o ON o."id" = t."tournamentId"
        WHERE t."id" = ${teamId} FOR UPDATE OF t`;
      if (!team) throw new NotFoundError();
      if (team.organizerId !== organizerId) throw new ForbiddenError();
      if (team.archived) throw new ArchivedError();
      const { tournamentId } = team;

      const latest = await tx.teamMember.findFirst({
        where: { tournamentId, userId },
        orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
        select: { id: true, teamId: true, endReason: true },
      });
      if (!latest) throw new NotAMemberError();
      const active = await tx.teamMember.count({
        where: { tournamentId, userId, status: "ACTIVE" },
      });
      if (active > 0) throw new AlreadyMemberError();
      const members = await tx.teamMember.count({ where: { teamId, status: "ACTIVE" } });
      if (members >= team.memberLimit) throw new TeamFullError();

      const joined = await tx.teamMember.create({
        data: { teamId, tournamentId, userId, joinedAt: now },
      });
      await recordAudit(tx, {
        actor: { type: "USER", userId: organizerId },
        action: AUDIT_ACTIONS.PLAYER_ADDED_BY_ORGANIZER,
        entityType: "TeamMember",
        entityId: joined.id,
        tournamentId,
        before: {
          userId,
          membershipId: latest.id,
          teamId: latest.teamId,
          endReason: latest.endReason,
        },
        after: { userId, teamId, status: "ACTIVE", joinedAt: now.toISOString() },
      });
      await emitEvent(tx, {
        type: "PLAYER_ADDED_TO_TEAM",
        payload: { tournamentId, teamId, userId, addedBy: organizerId },
      });
      return { membershipId: joined.id, tournamentId };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AlreadyMemberError();
    throw err;
  }
}
