import { isArchivable } from "@/lib/tournaments/lifecycle";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";

export type ArchiveResult =
  { ok: true; archivedAt: Date; changed: boolean } | { ok: false; reason: "NOT_COMPLETED" };

/**
 * The organizer archives a completed tournament (story S-35 AC 3, 4). Organizer only (throws
 * the role errors of `requireOrganizer`). Allowed only once `isArchivable` (else NOT_COMPLETED).
 * The write is conditional on the status and season end read, and commits with its
 * `TOURNAMENT_ARCHIVED` audit event; earlier audit rows are never touched. A repeat call on an
 * archived tournament changes and audits nothing and returns the stored `archivedAt`.
 */
export async function archiveTournament(
  userId: string,
  id: string,
  now: Date,
): Promise<ArchiveResult> {
  const t = await requireOrganizer(userId, id);
  if (t.status === "ARCHIVED" && t.archivedAt)
    return { ok: true, archivedAt: t.archivedAt, changed: false };
  if (!isArchivable(t, now)) return { ok: false, reason: "NOT_COMPLETED" };

  const changed = await db.$transaction(async (tx) => {
    const { count } = await tx.tournament.updateMany({
      where: { id: t.id, status: t.status, seasonEndAt: t.seasonEndAt },
      data: { status: "ARCHIVED", archivedAt: now },
    });
    if (count > 0)
      await recordAudit(tx, {
        actor: { type: "USER", userId },
        action: AUDIT_ACTIONS.TOURNAMENT_ARCHIVED,
        entityType: "Tournament",
        entityId: t.id,
        tournamentId: t.id,
        before: { status: t.status },
        after: { status: "ARCHIVED", archivedAt: now.toISOString() },
      });
    return count > 0;
  });
  if (changed) return { ok: true, archivedAt: now, changed: true };

  // Lost a race: another call archived it (no-op), or the tournament changed (refuse).
  const stored = await db.tournament.findUnique({
    where: { id: t.id },
    select: { status: true, archivedAt: true },
  });
  if (stored?.status === "ARCHIVED" && stored.archivedAt)
    return { ok: true, archivedAt: stored.archivedAt, changed: false };
  return { ok: false, reason: "NOT_COMPLETED" };
}
