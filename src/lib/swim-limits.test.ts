import { describe, expect, it } from "vitest";
import {
  DEFAULT_SWIM_LIMITS,
  STARTING_SWIM_LIMIT_CONFIG,
  SWIM_LIMIT_BOUNDS,
  validateLimitConfig,
  type SwimLimitConfig,
} from "./swim-limits";

const valid = (): SwimLimitConfig => ({
  defaults: {
    fastestPaceSecPer100m: 70,
    slowestPaceSecPer100m: 280,
    longestRealisticSwimM: 25_000,
  },
  bounds: {
    fastestPaceSecPer100m: { min: 50, max: 110 },
    slowestPaceSecPer100m: { min: 200, max: 500 },
    longestRealisticSwimM: { min: 10_000, max: 40_000 },
  },
});

describe("STARTING_SWIM_LIMIT_CONFIG", () => {
  it("starts at 1:05 and 5:00 per 100 m and 30 km inside the stand-in bounds", () => {
    expect(STARTING_SWIM_LIMIT_CONFIG).toEqual({
      defaults: {
        fastestPaceSecPer100m: 65,
        slowestPaceSecPer100m: 300,
        longestRealisticSwimM: 30_000,
      },
      bounds: {
        fastestPaceSecPer100m: { min: 45, max: 120 },
        slowestPaceSecPer100m: { min: 180, max: 600 },
        longestRealisticSwimM: { min: 5_000, max: 60_000 },
      },
    });
    expect(STARTING_SWIM_LIMIT_CONFIG.defaults).toEqual(DEFAULT_SWIM_LIMITS);
    expect(STARTING_SWIM_LIMIT_CONFIG.bounds).toEqual(SWIM_LIMIT_BOUNDS);
    expect(validateLimitConfig(STARTING_SWIM_LIMIT_CONFIG)).toEqual({
      ok: true,
      config: STARTING_SWIM_LIMIT_CONFIG,
    });
  });
});

describe("validateLimitConfig", () => {
  it("accepts a valid config and returns only the known fields", () => {
    const input = { ...valid(), extra: "dropped" };
    expect(validateLimitConfig(input)).toEqual({ ok: true, config: valid() });
  });

  it("accepts a default equal to its bound", () => {
    const c = valid();
    c.defaults.fastestPaceSecPer100m = 50;
    c.defaults.longestRealisticSwimM = 40_000;
    expect(validateLimitConfig(c).ok).toBe(true);
  });

  it("refuses a default outside its bounds", () => {
    const c = valid();
    c.defaults.fastestPaceSecPer100m = 49;
    c.defaults.longestRealisticSwimM = 40_001;
    expect(validateLimitConfig(c)).toEqual({
      ok: false,
      errors: {
        "defaults.fastestPaceSecPer100m": "OUT_OF_BOUNDS",
        "defaults.longestRealisticSwimM": "OUT_OF_BOUNDS",
      },
    });
  });

  it("refuses a lowest bound above the highest", () => {
    const c = valid();
    c.bounds.slowestPaceSecPer100m = { min: 300, max: 299 };
    c.defaults.slowestPaceSecPer100m = 300;
    expect(validateLimitConfig(c)).toEqual({
      ok: false,
      errors: { "bounds.slowestPaceSecPer100m": "MIN_ABOVE_MAX" },
    });
  });

  it("refuses a default fastest pace that is not faster than the default slowest pace", () => {
    const c = valid();
    c.bounds.fastestPaceSecPer100m = { min: 50, max: 300 };
    c.bounds.slowestPaceSecPer100m = { min: 100, max: 500 };
    c.defaults.fastestPaceSecPer100m = 200;
    c.defaults.slowestPaceSecPer100m = 200;
    expect(validateLimitConfig(c)).toEqual({
      ok: false,
      errors: { "defaults.fastestPaceSecPer100m": "NOT_FASTER_THAN_SLOWEST" },
    });
  });

  it("refuses missing, non-integer, non-positive and non-numeric values per field", () => {
    const c = valid() as unknown as {
      defaults: Record<string, unknown>;
      bounds: Record<string, Record<string, unknown>>;
    };
    delete c.defaults.fastestPaceSecPer100m;
    c.defaults.slowestPaceSecPer100m = 280.5;
    c.defaults.longestRealisticSwimM = "25000";
    c.bounds.fastestPaceSecPer100m.min = 0;
    c.bounds.longestRealisticSwimM.max = Number.POSITIVE_INFINITY;
    const result = validateLimitConfig(c);
    expect(result).toEqual({
      ok: false,
      errors: {
        "defaults.fastestPaceSecPer100m": "INVALID_NUMBER",
        "defaults.slowestPaceSecPer100m": "INVALID_NUMBER",
        "defaults.longestRealisticSwimM": "INVALID_NUMBER",
        "bounds.fastestPaceSecPer100m.min": "INVALID_NUMBER",
        "bounds.longestRealisticSwimM.max": "INVALID_NUMBER",
      },
    });
  });

  it("refuses a value that is not an object", () => {
    for (const input of [null, undefined, "x", 1, [], { defaults: null, bounds: [] }]) {
      expect(validateLimitConfig(input).ok).toBe(false);
    }
  });
});
