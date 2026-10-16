import { z } from "zod";
import { MAX_SETTING_KM } from "./swim";

/** Inclusive [min, max] of each point value; input keys are the stored column names. */
export const POINT_VALUE_RANGES = {
  pointsPerKm: [1, 1000],
  firstSwimBonusPoints: [0, 1000],
  longSwimTier1M: [1, MAX_SETTING_KM * 1000],
  longSwimTier1Points: [0, 1000],
  longSwimTier2M: [1, MAX_SETTING_KM * 1000],
  longSwimTier2Points: [0, 1000],
  multiplierTwoDaysPct: [100, 300],
  multiplierThreeDaysPct: [100, 300],
  streakStepPct: [0, 50],
  multiplierMaxPct: [100, 300],
} as const;

type Key = keyof typeof POINT_VALUE_RANGES;

/** A whole number as typed (string) or a number, inside [min, max]. */
const int = (min: number, max: number) =>
  z.unknown().transform((value, ctx) => {
    const raw = typeof value === "string" ? value.trim() : value;
    const n = typeof raw === "string" && /^[+-]?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    let error: string | null = null;
    if (raw === undefined || raw === null || raw === "") error = "POINTS_REQUIRED";
    else if (typeof n !== "number" || !Number.isInteger(n)) error = "POINTS_INVALID";
    else if (n < min || n > max) error = "POINTS_OUT_OF_RANGE";
    if (error === null) return n as number;
    ctx.addIssue({ code: "custom", message: error });
    return z.NEVER;
  });

const shape = Object.fromEntries(
  Object.entries(POINT_VALUE_RANGES).map(([key, [min, max]]) => [key, int(min, max)]),
) as Record<Key, ReturnType<typeof int>>;

/**
 * S-25 point values (FR-78 item 7, BR-29): every scoring number of the tournament, integers only
 * (percent 110 = x1.10). Tier 2 distance must be above tier 1, and the maximum multiplier not
 * below the 3+ day one. Season-locked; XP never reads these (platform values, S-51).
 */
export const pointsSettingsSchema = z.strictObject(shape).superRefine((v, ctx) => {
  if (v.longSwimTier2M <= v.longSwimTier1M)
    ctx.addIssue({ code: "custom", path: ["longSwimTier2M"], message: "TIER_2_NOT_ABOVE_TIER_1" });
  if (v.multiplierMaxPct < v.multiplierThreeDaysPct)
    ctx.addIssue({ code: "custom", path: ["multiplierMaxPct"], message: "MAX_BELOW_THREE_DAYS" });
});

export const POINTS_COLUMNS = Object.keys(POINT_VALUE_RANGES) as Key[];
