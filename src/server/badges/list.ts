import type { BadgeKind } from "@prisma/client";
import { db } from "@/server/db";

export type BadgeListItem = {
  id: string;
  userId: string;
  kind: BadgeKind;
  /** Organizer's reason for a manual (Special) badge; null otherwise. */
  reason: string | null;
  awardedAt: Date;
  tournament: { id: string; name: string };
};

const select = {
  id: true,
  userId: true,
  kind: true,
  reason: true,
  awardedAt: true,
  tournament: { select: { id: true, name: true } },
} as const;
const orderBy = [{ awardedAt: "desc" }, { id: "desc" }] as const;

/** A player's active (not removed) badges across all tournaments, newest first. */
export function listUserBadges(userId: string): Promise<BadgeListItem[]> {
  return db.badge.findMany({ where: { userId, removedAt: null }, select, orderBy: [...orderBy] });
}

/** Active badges of the given players in one tournament, by user id, newest first. */
export async function listMembersBadges(tournamentId: string, userIds: string[]) {
  const result = new Map<string, BadgeListItem[]>(userIds.map((id) => [id, []]));
  const where = { tournamentId, userId: { in: userIds }, removedAt: null };
  const rows = await db.badge.findMany({ where, select, orderBy: [...orderBy] });
  for (const row of rows) result.get(row.userId)?.push(row);
  return result;
}
