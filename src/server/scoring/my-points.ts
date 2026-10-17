import { db } from "@/server/db";

export type MyPointsWeek = {
  weekStart: string;
  activeDays: number;
  multiplierPct: number;
  extraPoints: number;
};

export type MyPoints = {
  total: number;
  distance: number;
  bonuses: number;
  multiplierExtra: number;
  weeks: MyPointsWeek[];
};

/**
 * One player's points in one tournament split by kind, plus each settled week with its
 * multiplier, newest first. Reads only the given user's rows. Reversal entries correct earlier
 * swim points, so they count with `distance`; `total` is the sum of the player's ledger.
 */
export async function getMyPoints(userId: string, tournamentId: string): Promise<MyPoints> {
  const [rows, weeks] = await Promise.all([
    db.pointsEntry.groupBy({
      by: ["kind"],
      where: { userId, tournamentId },
      _sum: { points: true },
    }),
    db.weeklyResult.findMany({
      where: { userId, tournamentId },
      orderBy: { weekStart: "desc" },
      select: { weekStart: true, activeDays: true, multiplierPct: true, extraPoints: true },
    }),
  ]);
  const sum = (...kinds: string[]) =>
    rows.filter((r) => kinds.includes(r.kind)).reduce((n, r) => n + (r._sum.points ?? 0), 0);
  const distance = sum("DISTANCE", "REVERSAL");
  const bonuses = sum("FIRST_SWIM_BONUS", "LONG_SWIM_BONUS");
  const multiplierExtra = sum("WEEKLY_MULTIPLIER");
  return { total: distance + bonuses + multiplierExtra, distance, bonuses, multiplierExtra, weeks };
}
