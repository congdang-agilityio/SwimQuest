import type { BadgeKind } from "@prisma/client";
import { db } from "@/server/db";

export type BadgeListItem = {
  id: string;
  kind: BadgeKind;
  /** Organizer's reason for a manual (Special) badge; null otherwise. */
  reason: string | null;
  awardedAt: Date;
  tournament: { id: string; name: string };
};

export type MemberBadge = BadgeListItem & { userId: string };

const select = {
  id: true,
  kind: true,
  reason: true,
  awardedAt: true,
  userId: true,
  tournament: { select: { id: true, name: true } },
} as const;

const newestFirst = [{ awardedAt: "desc" }, { id: "desc" }] as const;

/** A player's active (not removed) badges across all tournaments, newest first. */
export async function listUserBadges(userId: string): Promise<BadgeListItem[]> {
  const rows = await db.badge.findMany({
    where: { userId, removedAt: null },
    select,
    orderBy: [...newestFirst],
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    reason: r.reason,
    awardedAt: r.awardedAt,
    tournament: r.tournament,
  }));
}

/** Active badges of the given players in one tournament, grouped by user id, newest first. */
export async function listMembersBadges(
  tournamentId: string,
  userIds: string[],
): Promise<Map<string, MemberBadge[]>> {
  const result = new Map<string, MemberBadge[]>(userIds.map((id) => [id, []]));
  if (userIds.length === 0) return result;
  const rows = await db.badge.findMany({
    where: { tournamentId, userId: { in: userIds }, removedAt: null },
    select,
    orderBy: [...newestFirst],
  });
  for (const row of rows) result.get(row.userId)?.push(row);
  return result;
}
