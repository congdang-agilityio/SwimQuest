import { describe, expect, it } from "vitest";
import { swimSettingsSchema } from "./swim";

const valid = { longestSwimCountedKm: "12.5", dailyLimitKm: 10, swimTypeAllowed: "POOL_ONLY" };
const errorsOf = (input: unknown) => {
  const parsed = swimSettingsSchema.safeParse(input);
  if (parsed.success) return null;
  return Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe("swimSettingsSchema", () => {
  it("accepts 12.5 km and stores metres", () => {
    expect(swimSettingsSchema.parse(valid)).toEqual({
      longestSwimCountedM: 12_500,
      dailyLimitM: 10_000,
      swimTypeAllowed: "POOL_ONLY",
    });
  });

  it("accepts up to 2 decimals and every swim type", () => {
    for (const swimTypeAllowed of ["ANY", "POOL_ONLY", "OPEN_WATER_ONLY"]) {
      const out = swimSettingsSchema.parse({ ...valid, dailyLimitKm: " 0.25 ", swimTypeAllowed });
      expect(out).toMatchObject({ dailyLimitM: 250, swimTypeAllowed });
    }
  });

  it("refuses 0 and negative distances", () => {
    expect(errorsOf({ ...valid, longestSwimCountedKm: 0 })).toEqual({
      longestSwimCountedKm: "DISTANCE_NOT_POSITIVE",
    });
    expect(errorsOf({ ...valid, dailyLimitKm: "-1" })).toEqual({
      dailyLimitKm: "DISTANCE_NOT_POSITIVE",
    });
  });

  it("refuses missing, malformed, too precise and too large distances", () => {
    expect(errorsOf({ ...valid, dailyLimitKm: undefined })).toEqual({
      dailyLimitKm: "DISTANCE_REQUIRED",
    });
    expect(errorsOf({ ...valid, dailyLimitKm: "" })).toEqual({ dailyLimitKm: "DISTANCE_REQUIRED" });
    expect(errorsOf({ ...valid, dailyLimitKm: "abc" })).toEqual({
      dailyLimitKm: "DISTANCE_INVALID",
    });
    expect(errorsOf({ ...valid, dailyLimitKm: Infinity })).toEqual({
      dailyLimitKm: "DISTANCE_INVALID",
    });
    expect(errorsOf({ ...valid, dailyLimitKm: "1.234" })).toEqual({
      dailyLimitKm: "DISTANCE_TOO_PRECISE",
    });
    expect(errorsOf({ ...valid, dailyLimitKm: 10_001 })).toEqual({
      dailyLimitKm: "DISTANCE_TOO_LARGE",
    });
  });

  it("refuses positive distances below 0.01 km instead of storing 0 m", () => {
    for (const dailyLimitKm of ["0.00000001", "0.000000001", "0.0000000049", 1e-9, 0.004]) {
      expect(errorsOf({ ...valid, dailyLimitKm })).toEqual({
        dailyLimitKm: "DISTANCE_TOO_PRECISE",
      });
    }
  });

  it("accepts 0.01 km as 10 m", () => {
    expect(swimSettingsSchema.parse({ ...valid, dailyLimitKm: "0.01" })).toMatchObject({
      dailyLimitM: 10,
    });
  });

  it("refuses an unknown swim type and unknown fields", () => {
    expect(errorsOf({ ...valid, swimTypeAllowed: "LAKE" })).toEqual({
      swimTypeAllowed: "SWIM_TYPE_INVALID",
    });
    expect(errorsOf({ ...valid, swimTypeAllowed: undefined })).toEqual({
      swimTypeAllowed: "SWIM_TYPE_INVALID",
    });
    const parsed = swimSettingsSchema.safeParse({ ...valid, pointsPerKm: 5 });
    expect(parsed.success).toBe(false);
  });
});
