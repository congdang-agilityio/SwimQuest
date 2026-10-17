import { activeDays } from "@/lib/scoring/weekly-multiplier";
import { vnWeekRange, vnWeekStart } from "@/lib/time/vn";
import type { db } from "@/server/db";

/** Reads only: works with the shared client or a transaction. */
type Db = Pick<typeof db, "weeklyResult" | "pointsEntry" | "swimResult">;

export const PEARL_MIN_ACTIVE_DAYS = 3;
export const ORB_MIN_ACTIVE_DAYS = 2;
const COIN_M = 1000;

export type PersonalCollectibles = {
  /** One per settled week with 3+ active days; `weekStart` is the Vietnam Monday, ascending. */
  pearls: { weekStart: string }[];
  /** One per long-swim bonus whose swim is still verified. */
  starfish: { swimResultId: string }[];
  /** One per full km of verified counted distance in the tournament. */
  coins: number;
  /** A state, not a collectible: 2+ active days in the current Vietnam week. */
  energyOrb: boolean;
};

/**
 * Collectibles of players in one tournament (FR-82), derived from current data on every call so a
 * revoked swim or a recalculated week removes them. Batched: four queries for any number of
 * players. Collecting only: nothing here changes points, progress or the race.
 */
export async function getPersonalCollectibles(
  client: Db,
  tournamentId: string,
  userIds: readonly string[],
  now: Date,
): Promise<Map<string, PersonalCollectibles>> {
  const ids = [...new Set(userIds)];
  const result = new Map<string, PersonalCollectibles>(
    ids.map((id) => [id, { pearls: [], starfish: [], coins: 0, energyOrb: false }]),
  );
  if (ids.length === 0) return result;
  const week = vnWeekRange(vnWeekStart(now));

  const [weeks, bonuses, verified, thisWeek] = await Promise.all([
    client.weeklyResult.findMany({
      where: { tournamentId, userId: { in: ids }, activeDays: { gte: PEARL_MIN_ACTIVE_DAYS } },
      select: { userId: true, weekStart: true },
      orderBy: { weekStart: "asc" },
    }),
    client.pointsEntry.findMany({
      where: {
        tournamentId,
        userId: { in: ids },
        kind: "LONG_SWIM_BONUS",
        swimResult: { status: "VERIFIED" },
      },
      select: { userId: true, swimResultId: true },
      orderBy: { createdAt: "asc" },
    }),
    client.swimResult.groupBy({
      by: ["userId"],
      where: { tournamentId, userId: { in: ids }, status: "VERIFIED" },
      _sum: { countedM: true },
    }),
    client.swimResult.findMany({
      where: {
        tournamentId,
        userId: { in: ids },
        status: "VERIFIED",
        swim: { startedAt: { gte: week.start, lt: week.end } },
      },
      select: { userId: true, swim: { select: { startedAt: true, distanceM: true } } },
    }),
  ]);

  for (const w of weeks) result.get(w.userId)?.pearls.push({ weekStart: w.weekStart });
  for (const b of bonuses) {
    if (b.swimResultId) result.get(b.userId)?.starfish.push({ swimResultId: b.swimResultId });
  }
  for (const v of verified) {
    const entry = result.get(v.userId);
    if (entry) entry.coins = Math.floor((v._sum.countedM ?? 0) / COIN_M);
  }
  const swimsByUser = new Map<string, { startedAt: Date; distanceM: number }[]>();
  for (const r of thisWeek) {
    const list = swimsByUser.get(r.userId) ?? [];
    list.push(r.swim);
    swimsByUser.set(r.userId, list);
  }
  for (const [userId, swims] of swimsByUser) {
    const entry = result.get(userId);
    if (entry) entry.energyOrb = activeDays(swims) >= ORB_MIN_ACTIVE_DAYS;
  }
  return result;
}
