// Weekly consistency multiplier (FR-49, BR-30). Integer math only (NFR-08).
import { vnDayKey } from "@/lib/time/vn";
import { PLATFORM_POINT_VALUES, type PointValues } from "./bonuses";

/** A verified swim; `distanceM` is its counted distance in metres. */
export type ActiveSwim = { startedAt: Date; distanceM: number };

export const ACTIVE_DAY_MIN_M = 500;

/** Distinct Vietnam days with at least one verified swim of 500 m or more. */
export function activeDays(swims: ActiveSwim[]): number {
  const days = new Set<string>();
  for (const s of swims) if (s.distanceM >= ACTIVE_DAY_MIN_M) days.add(vnDayKey(s.startedAt));
  return days.size;
}

/**
 * Multiplier in percent: 0-1 day 100; 2 days 110 (breaks the streak); 3+ days 120 plus the step
 * per earlier consecutive 3+ week, capped. `previousThreePlusStreak` counts those earlier weeks.
 */
export function weeklyMultiplierPct(input: {
  activeDays: number;
  previousThreePlusStreak: number;
  values?: Pick<
    PointValues,
    "multiplier2DaysPct" | "multiplier3DaysPct" | "multiplierStreakStepPct" | "multiplierMaxPct"
  >;
}): number {
  const { activeDays: days, previousThreePlusStreak: streak } = input;
  const v = input.values ?? PLATFORM_POINT_VALUES;
  if (!Number.isInteger(days) || days < 0) throw new RangeError("activeDays must be >= 0");
  if (!Number.isInteger(streak) || streak < 0) throw new RangeError("streak must be >= 0");
  if (days >= 3)
    return Math.min(v.multiplier3DaysPct + v.multiplierStreakStepPct * streak, v.multiplierMaxPct);
  return days === 2 ? v.multiplier2DaysPct : 100;
}

/**
 * Extra points the multiplier adds to the week's distance points (bonuses excluded), rounded to
 * the nearest whole number with .5 rounding up (Q-43: 64 x 1.20 = 77 total).
 */
export function extraPoints(distancePoints: number, pct: number): number {
  if (!Number.isFinite(distancePoints) || distancePoints < 0) {
    throw new RangeError("distancePoints must be a non-negative number");
  }
  if (!Number.isInteger(pct) || pct < 100) throw new RangeError("pct must be an integer >= 100");
  return Math.floor((distancePoints * (pct - 100) + 50) / 100);
}
