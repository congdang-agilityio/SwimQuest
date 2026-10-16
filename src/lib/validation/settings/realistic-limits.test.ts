import { describe, expect, it } from "vitest";
import { realisticLimitsSettingsSchema } from "./realistic-limits";

const starting = realisticLimitsSettingsSchema({
  swimLimitBounds: null,
  extraSlowestPaceSecPer100m: null,
});
const errorsOf = (schema: typeof starting, input: unknown) => {
  const parsed = schema.safeParse(input);
  if (parsed.success) return null;
  return Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
};
const valid = { fastestPace: "1:05", slowestPace: "5:00", longestRealisticSwimKm: "30" };

describe("realisticLimitsSettingsSchema", () => {
  it("stores paces as seconds per 100 m and the longest swim as metres", () => {
    expect(starting.parse(valid)).toEqual({
      fastestPaceSecPer100m: 65,
      slowestPaceSecPer100m: 300,
      longestRealisticSwimM: 30000,
    });
    expect(
      starting.parse({ fastestPace: 45, slowestPace: "10:00", longestRealisticSwimKm: 12.5 }),
    ).toEqual({
      fastestPaceSecPer100m: 45,
      slowestPaceSecPer100m: 600,
      longestRealisticSwimM: 12500,
    });
  });

  it("refuses values outside the starting bounds when the tournament has no snapshot", () => {
    expect(errorsOf(starting, { ...valid, fastestPace: "0:44" })).toEqual({
      fastestPace: "LIMIT_OUT_OF_BOUNDS",
      fastestPaceRange: "0:45-2:00",
    });
    expect(errorsOf(starting, { ...valid, slowestPace: "10:01" })).toEqual({
      slowestPace: "LIMIT_OUT_OF_BOUNDS",
      slowestPaceRange: "3:00-10:00",
    });
    expect(errorsOf(starting, { ...valid, longestRealisticSwimKm: "4.99" })).toEqual({
      longestRealisticSwimKm: "LIMIT_OUT_OF_BOUNDS",
      longestRealisticSwimKmRange: "5-60",
    });
    expect(errorsOf(starting, { ...valid, longestRealisticSwimKm: 60.01 })).toMatchObject({
      longestRealisticSwimKm: "LIMIT_OUT_OF_BOUNDS",
    });
  });

  it("uses the tournament's bounds snapshot, falling back per field when missing or broken", () => {
    const schema = realisticLimitsSettingsSchema({
      swimLimitBounds: {
        fastestPaceSecPer100m: { min: 50, max: 90 },
        slowestPaceSecPer100m: { min: 200, max: "x" },
        longestRealisticSwimM: { min: 10_000, max: 20_000 },
      },
      extraSlowestPaceSecPer100m: null,
    });
    expect(errorsOf(schema, valid)).toEqual({
      longestRealisticSwimKm: "LIMIT_OUT_OF_BOUNDS",
      longestRealisticSwimKmRange: "10-20",
    });
    expect(errorsOf(schema, { ...valid, fastestPace: "0:45", slowestPace: "9:00" })).toEqual({
      fastestPace: "LIMIT_OUT_OF_BOUNDS",
      fastestPaceRange: "0:50-1:30",
      longestRealisticSwimKm: "LIMIT_OUT_OF_BOUNDS",
      longestRealisticSwimKmRange: "10-20",
    });
    expect(schema.parse({ ...valid, longestRealisticSwimKm: "20" })).toMatchObject({
      longestRealisticSwimM: 20000,
    });
  });

  it("refuses a fastest pace that is not faster than the slowest pace", () => {
    const schema = realisticLimitsSettingsSchema({
      swimLimitBounds: {
        fastestPaceSecPer100m: { min: 45, max: 300 },
        slowestPaceSecPer100m: { min: 100, max: 600 },
      },
      extraSlowestPaceSecPer100m: null,
    });
    expect(errorsOf(schema, { ...valid, fastestPace: "3:00", slowestPace: "3:00" })).toEqual({
      fastestPace: "FASTEST_NOT_FASTER_THAN_SLOWEST",
    });
    expect(schema.parse({ ...valid, fastestPace: "2:59", slowestPace: "3:00" })).toMatchObject({
      fastestPaceSecPer100m: 179,
    });
  });

  it("refuses a slowest pace that the existing extra slowest pace would no longer beat", () => {
    const schema = realisticLimitsSettingsSchema({
      swimLimitBounds: null,
      extraSlowestPaceSecPer100m: 240,
    });
    expect(errorsOf(schema, { ...valid, slowestPace: "4:00" })).toEqual({
      slowestPace: "EXTRA_PACE_NOT_STRICTER",
      extraSlowestPace: "4:00",
    });
    expect(schema.parse({ ...valid, slowestPace: "4:01" })).toMatchObject({
      slowestPaceSecPer100m: 241,
    });
  });

  it("refuses missing, malformed and too precise values and unknown fields", () => {
    expect(errorsOf(starting, {})).toEqual({
      fastestPace: "PACE_INVALID",
      slowestPace: "PACE_INVALID",
      longestRealisticSwimKm: "DISTANCE_INVALID",
    });
    for (const longestRealisticSwimKm of ["abc", "-10", "10.001", 10.001, {}, ""])
      expect(errorsOf(starting, { ...valid, longestRealisticSwimKm })).toEqual({
        longestRealisticSwimKm: "DISTANCE_INVALID",
      });
    expect(errorsOf(starting, { ...valid, fastestPace: "1:60" })).toEqual({
      fastestPace: "PACE_INVALID",
    });
    expect(starting.safeParse({ ...valid, other: 1 }).success).toBe(false);
  });
});
