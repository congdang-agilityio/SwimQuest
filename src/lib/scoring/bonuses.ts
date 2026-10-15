// First-swim and long-swim bonus points (FR-49, BR-29). Integer math only (NFR-08).
export type PointValues = {
  firstSwimPoints: number;
  longSwimTier1M: number;
  longSwimTier1Points: number;
  longSwimTier2M: number;
  longSwimTier2Points: number;
  /** Weekly multiplier in percent: 2 active days, 3+ active days, +step per streak week, cap. */
  multiplier2DaysPct: number;
  multiplier3DaysPct: number;
  multiplierStreakStepPct: number;
  multiplierMaxPct: number;
  pointsPerKm: number;
};

/** Platform defaults (BR-29); also used for personal XP (S-51). */
export const PLATFORM_POINT_VALUES: PointValues = {
  firstSwimPoints: 20,
  longSwimTier1M: 1000,
  longSwimTier1Points: 10,
  longSwimTier2M: 3000,
  longSwimTier2Points: 25,
  multiplier2DaysPct: 110,
  multiplier3DaysPct: 120,
  multiplierStreakStepPct: 5,
  multiplierMaxPct: 140,
  pointsPerKm: 10,
};

/** Bonus for a swim's counted distance (metres): 0, tier 1 points, or tier 2 points instead. */
export function longSwimBonus(
  countedM: number,
  values: Pick<
    PointValues,
    "longSwimTier1M" | "longSwimTier1Points" | "longSwimTier2M" | "longSwimTier2Points"
  > = PLATFORM_POINT_VALUES,
): number {
  if (!Number.isFinite(countedM) || countedM < 0) {
    throw new RangeError("countedM must be a non-negative number");
  }
  if (countedM >= values.longSwimTier2M) return values.longSwimTier2Points;
  if (countedM >= values.longSwimTier1M) return values.longSwimTier1Points;
  return 0;
}

export function firstSwimBonus(
  values: Pick<PointValues, "firstSwimPoints"> = PLATFORM_POINT_VALUES,
): number {
  return values.firstSwimPoints;
}
