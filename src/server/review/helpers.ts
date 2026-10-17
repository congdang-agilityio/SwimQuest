import { Prisma } from "@prisma/client";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";

/** The user has no active membership in the tournament, so cannot be a review helper. */
export class NotAPlayerError extends Error {
  readonly status = 400;
  readonly code = "NOT_A_PLAYER";
}

/** The user is already an active review helper of the tournament. */
export class AlreadyHelperError extends Error {
  readonly status = 409;
  readonly code = "ALREADY_HELPER";
}

/** The user is not an active review helper of the tournament. */
export class NotAHelperError extends Error {
  readonly status = 404;
  readonly code = "NOT_A_HELPER";
}

export type ReviewHelperView = { userId: string; displayName: string; appointedAt: Date };

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * The organizer appoints a player of the tournament (an ACTIVE membership) as review helper
 * (S-45 AC 1, FR-71). The helper passes `requireReviewer` for this tournament only and gets no
 * other organizer power. Audited as `REVIEW_HELPER_APPOINTED` in the same transaction. Throws
 * NotFoundError, ForbiddenError, NotAPlayerError and AlreadyHelperError.
 */
export async function appointHelper(
  organizerId: string,
  tournamentId: string,
  userId: string,
  now: Date = new Date(),
): Promise<{ helperId: string }> {
  await requireOrganizer(organizerId, tournamentId, { write: true });
  if (!isId(userId)) throw new NotAPlayerError();
  try {
    return await db.$transaction(async (tx) => {
      const member = await tx.teamMember.count({
        where: { tournamentId, userId, status: "ACTIVE" },
      });
      if (member === 0) throw new NotAPlayerError();
      const active = await tx.reviewHelper.count({
        where: { tournamentId, userId, removedAt: null },
      });
      if (active > 0) throw new AlreadyHelperError();
      const helper = await tx.reviewHelper.create({
        data: { tournamentId, userId, appointedById: organizerId, createdAt: now },
      });
      await recordAudit(tx, {
        actor: { type: "USER", userId: organizerId },
        action: AUDIT_ACTIONS.REVIEW_HELPER_APPOINTED,
        entityType: "ReviewHelper",
        entityId: helper.id,
        tournamentId,
        before: { userId, helper: false },
        after: { userId, helper: true, appointedAt: now.toISOString() },
      });
      return { helperId: helper.id };
    });
  } catch (err) {
    // Two appointments at once: the partial unique index lets only one active row in.
    if (isUniqueViolation(err)) throw new AlreadyHelperError();
    throw err;
  }
}

/**
 * The organizer removes a review helper (S-45 AC 4). The row is kept with `removedAt` set;
 * roles are read from the database on every request, so access ends with the next request.
 * Audited as `REVIEW_HELPER_REMOVED`. Throws NotFoundError, ForbiddenError and NotAHelperError.
 */
export async function removeHelper(
  organizerId: string,
  tournamentId: string,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await requireOrganizer(organizerId, tournamentId, { write: true });
  if (!isId(userId)) throw new NotAHelperError();
  await db.$transaction(async (tx) => {
    // Conditional update: of two removals at once only one changes the row.
    const removed = await tx.reviewHelper.updateManyAndReturn({
      where: { tournamentId, userId, removedAt: null },
      data: { removedAt: now },
      select: { id: true, createdAt: true },
    });
    if (removed.length === 0) throw new NotAHelperError();
    await recordAudit(tx, {
      actor: { type: "USER", userId: organizerId },
      action: AUDIT_ACTIONS.REVIEW_HELPER_REMOVED,
      entityType: "ReviewHelper",
      entityId: removed[0].id,
      tournamentId,
      before: { userId, helper: true, appointedAt: removed[0].createdAt.toISOString() },
      after: { userId, helper: false, removedAt: now.toISOString() },
    });
  });
}

/** The tournament's active review helpers, oldest appointment first (organizer only). */
export async function listHelpers(
  organizerId: string,
  tournamentId: string,
): Promise<ReviewHelperView[]> {
  await requireOrganizer(organizerId, tournamentId);
  const rows = await db.reviewHelper.findMany({
    where: { tournamentId, removedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { userId: true, createdAt: true, user: { select: { displayName: true } } },
  });
  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.user.displayName,
    appointedAt: r.createdAt,
  }));
}

/** Whether the user is an active review helper of the tournament (read fresh, never cached). */
export async function isReviewHelper(userId: string, tournamentId: string): Promise<boolean> {
  if (!isId(userId) || !isId(tournamentId)) return false;
  return (await db.reviewHelper.count({ where: { tournamentId, userId, removedAt: null } })) > 0;
}
