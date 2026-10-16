import { levelForXp, xpToNextLevel } from "@/lib/scoring/levels";
import { db } from "@/server/db";

export type PlayerLevel = { xp: number; level: number; xpToNext: number };

/**
 * Total XP, level and XP to the next level for many players in one grouped query (S-51).
 * REVERSAL entries carry negative XP, so a revoked swim lowers the total. Players without XP
 * entries are level 1 with 0 XP. Every requested id is in the result.
 */
export async function getLevels(userIds: string[]): Promise<Map<string, PlayerLevel>> {
  const ids = [...new Set(userIds)];
  const result = new Map<string, PlayerLevel>();
  if (ids.length === 0) return result;
  const sums = await db.xpEntry.groupBy({
    by: ["userId"],
    where: { userId: { in: ids } },
    _sum: { xp: true },
  });
  const totals = new Map(sums.map((s) => [s.userId, s._sum.xp ?? 0]));
  for (const id of ids) {
    const xp = Math.max(0, totals.get(id) ?? 0);
    result.set(id, { xp, level: levelForXp(xp), xpToNext: xpToNextLevel(xp) });
  }
  return result;
}
