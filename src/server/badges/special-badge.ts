import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { NotAPlayerError } from "@/server/review/helpers";
import { awardBadge } from "./award";

/** Longest reason the organizer may give with a Special badge. */
export const SPECIAL_REASON_MAX = 200;

/** The reason is missing, blank or longer than `SPECIAL_REASON_MAX` characters. */
export class InvalidSpecialReasonError extends Error {
  readonly status = 400;
  readonly code = "VALIDATION_FAILED";
  readonly fields = { reason: "REASON_LENGTH" };
}

/** The player already holds the Special badge in this tournament. */
export class AlreadyAwardedError extends Error {
  readonly status = 409;
  readonly code = "ALREADY_AWARDED";
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * The organizer gives a player of the tournament (any membership, current or ended) the Special
 * badge once, with a short reason (S-50 AC 3-5, FR-51). The badge keeps the reason, the giver and
 * the team of the player's latest membership. Audited as `SPECIAL_BADGE_GIVEN` (who, whom, when,
 * why) in the same transaction. Throws NotFoundError, ForbiddenError, ArchivedError,
 * InvalidSpecialReasonError, NotAPlayerError and AlreadyAwardedError.
 */
export async function giveSpecialBadge(
  organizerId: string,
  tournamentId: string,
  userId: string,
  reason: unknown,
  now: Date = new Date(),
): Promise<{ badgeId: string }> {
  await requireOrganizer(organizerId, tournamentId, { write: true });
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < 1 || text.length > SPECIAL_REASON_MAX) throw new InvalidSpecialReasonError();
  if (!isId(userId)) throw new NotAPlayerError();

  return db.$transaction(async (tx) => {
    const member = await tx.teamMember.findFirst({
      where: { tournamentId, userId },
      orderBy: { joinedAt: "desc" },
      select: { teamId: true },
    });
    if (!member) throw new NotAPlayerError();
    const target = { tournamentId, userId, kind: "SPECIAL" as const };
    const awarded = await awardBadge(tx, {
      ...target,
      teamId: member.teamId,
      reason: text,
      givenById: organizerId,
    });
    if (!awarded) throw new AlreadyAwardedError();
    const badge = await tx.badge.findFirstOrThrow({
      where: { ...target, removedAt: null },
      select: { id: true },
    });
    await recordAudit(tx, {
      actor: { type: "USER", userId: organizerId },
      action: AUDIT_ACTIONS.SPECIAL_BADGE_GIVEN,
      entityType: "Badge",
      entityId: badge.id,
      tournamentId,
      before: { userId, special: false },
      after: { userId, special: true, givenById: organizerId, givenAt: now.toISOString() },
      reason: text,
    });
    return { badgeId: badge.id };
  });
}
