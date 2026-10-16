import { describe, expect, it } from "vitest";
import { pointsSettingsSchema } from "./points";

const PLATFORM = {
  pointsPerKm: 10,
  firstSwimBonusPoints: 20,
  longSwimTier1M: 1000,
  longSwimTier1Points: 10,
  longSwimTier2M: 3000,
  longSwimTier2Points: 25,
  multiplierTwoDaysPct: 110,
  multiplierThreeDaysPct: 120,
  streakStepPct: 5,
  multiplierMaxPct: 140,
};
const errorsOf = (input: unknown) => {
  const parsed = pointsSettingsSchema.safeParse(input);
  if (parsed.success) return null;
  return Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe("pointsSettingsSchema", () => {
  it("accepts the platform values, as numbers or trimmed text", () => {
    expect(pointsSettingsSchema.parse(PLATFORM)).toEqual(PLATFORM);
    const typed = Object.fromEntries(Object.entries(PLATFORM).map(([k, v]) => [k, ` ${v} `]));
    expect(pointsSettingsSchema.parse(typed)).toEqual(PLATFORM);
  });

  it("accepts the bounds of every range", () => {
    const low = {
      ...PLATFORM,
      pointsPerKm: 1,
      firstSwimBonusPoints: 0,
      longSwimTier1Points: 0,
      longSwimTier2Points: 0,
      multiplierTwoDaysPct: 100,
      multiplierThreeDaysPct: 100,
      streakStepPct: 0,
      multiplierMaxPct: 100,
    };
    expect(pointsSettingsSchema.parse(low)).toEqual(low);
    const high = {
      ...PLATFORM,
      pointsPerKm: 1000,
      firstSwimBonusPoints: 1000,
      multiplierTwoDaysPct: 300,
      multiplierThreeDaysPct: 300,
      streakStepPct: 50,
      multiplierMaxPct: 300,
    };
    expect(pointsSettingsSchema.parse(high)).toEqual(high);
  });

  it("refuses values outside their range", () => {
    for (const [key, value] of [
      ["pointsPerKm", 0],
      ["pointsPerKm", 1001],
      ["firstSwimBonusPoints", -1],
      ["firstSwimBonusPoints", 1001],
      ["longSwimTier1M", 0],
      ["longSwimTier2Points", 1001],
      ["multiplierTwoDaysPct", 99],
      ["multiplierTwoDaysPct", 301],
      ["streakStepPct", -1],
      ["streakStepPct", 51],
      ["multiplierMaxPct", 301],
    ] as const) {
      expect(errorsOf({ ...PLATFORM, [key]: value })).toEqual({ [key]: "POINTS_OUT_OF_RANGE" });
    }
  });

  it("refuses 3+ day multipliers out of range without a second error on the maximum", () => {
    expect(errorsOf({ ...PLATFORM, multiplierThreeDaysPct: 301 })).toEqual({
      multiplierThreeDaysPct: "POINTS_OUT_OF_RANGE",
    });
  });

  it("refuses fractions, non-numbers and missing values", () => {
    expect(errorsOf({ ...PLATFORM, pointsPerKm: 10.5 })).toEqual({ pointsPerKm: "POINTS_INVALID" });
    expect(errorsOf({ ...PLATFORM, pointsPerKm: "1.5" })).toEqual({
      pointsPerKm: "POINTS_INVALID",
    });
    expect(errorsOf({ ...PLATFORM, streakStepPct: "abc" })).toEqual({
      streakStepPct: "POINTS_INVALID",
    });
    expect(errorsOf({ ...PLATFORM, streakStepPct: true })).toEqual({
      streakStepPct: "POINTS_INVALID",
    });
    expect(errorsOf({ ...PLATFORM, multiplierMaxPct: Infinity })).toEqual({
      multiplierMaxPct: "POINTS_INVALID",
    });
    expect(errorsOf({ ...PLATFORM, firstSwimBonusPoints: "" })).toEqual({
      firstSwimBonusPoints: "POINTS_REQUIRED",
    });
    expect(errorsOf({ ...PLATFORM, longSwimTier2M: undefined })).toEqual({
      longSwimTier2M: "POINTS_REQUIRED",
    });
  });

  it("refuses a tier 2 distance not above tier 1", () => {
    expect(errorsOf({ ...PLATFORM, longSwimTier2M: 1000 })).toEqual({
      longSwimTier2M: "TIER_2_NOT_ABOVE_TIER_1",
    });
    expect(pointsSettingsSchema.parse({ ...PLATFORM, longSwimTier2M: 1001 }).longSwimTier2M).toBe(
      1001,
    );
  });

  it("refuses a maximum below the 3+ day multiplier", () => {
    expect(errorsOf({ ...PLATFORM, multiplierMaxPct: 119 })).toEqual({
      multiplierMaxPct: "MAX_BELOW_THREE_DAYS",
    });
    expect(
      pointsSettingsSchema.parse({ ...PLATFORM, multiplierMaxPct: 120 }).multiplierMaxPct,
    ).toBe(120);
  });

  it("refuses unknown fields", () => {
    expect(pointsSettingsSchema.safeParse({ ...PLATFORM, dailyLimitM: 5 }).success).toBe(false);
  });
});
