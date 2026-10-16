import type { BadgeKind } from "@prisma/client";
import type { Tx } from "@/server/checks/run-checks";
import { emitEvent } from "@/server/events/emit";

export type BadgeTarget = { tournamentId: string; userId: string; kind: BadgeKind };

/**
 * Serializes award and removal of one badge kind for one player in one tournament until the
 * transaction ends, so two concurrent awards cannot both see "no active badge yet".
 */
async function lockBadge(tx: Tx, { tournamentId, userId, kind }: BadgeTarget): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`badge:${tournamentId}:${userId}:${kind}`}))`;
}

const activeBadge = (tx: Tx, { tournamentId, userId, kind }: BadgeTarget) =>
  tx.badge.findFirst({ where: { tournamentId, userId, kind, removedAt: null } });

/**
 * Gives a player a badge in a tournament (S-48, FR-51) and emits `BADGE_AWARDED`. A no-op when
 * the player already holds an active badge of that kind there. Badges never write points or XP.
 * Returns whether a badge was awarded.
 */
export async function awardBadge(
  tx: Tx,
  input: BadgeTarget & { teamId?: string | null; reason?: string; givenById?: string },
): Promise<boolean> {
  await lockBadge(tx, input);
  if (await activeBadge(tx, input)) return false;
  const { tournamentId, userId, kind } = input;
  await tx.badge.create({
    data: {
      tournamentId,
      userId,
      kind,
      teamId: input.teamId ?? null,
      reason: input.reason ?? null,
      givenById: input.givenById ?? null,
    },
  });
  await emitEvent(tx, { type: "BADGE_AWARDED", payload: { tournamentId, userId, badgeKey: kind } });
  return true;
}

/**
 * Removes a player's active badge in a tournament: sets `removedAt` and the reason (the row is
 * kept) and emits `BADGE_REMOVED`. A no-op when there is no active badge. Returns whether one
 * was removed.
 */
export async function removeBadge(tx: Tx, target: BadgeTarget, reason: string): Promise<boolean> {
  await lockBadge(tx, target);
  const badge = await activeBadge(tx, target);
  if (!badge) return false;
  await tx.badge.update({
    where: { id: badge.id },
    data: { removedAt: new Date(), removedReason: reason },
  });
  const { tournamentId, userId, kind } = target;
  await emitEvent(tx, { type: "BADGE_REMOVED", payload: { tournamentId, userId, badgeKey: kind } });
  return true;
}
