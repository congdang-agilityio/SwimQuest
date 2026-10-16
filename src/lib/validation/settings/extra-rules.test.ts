import { describe, expect, it } from "vitest";
import { extraRulesSettingsSchema } from "./extra-rules";

const schema = extraRulesSettingsSchema({
  slowestPaceSecPer100m: 300,
  longestRealisticSwimM: 30000,
});
const errorsOf = (input: unknown) => {
  const parsed = schema.safeParse(input);
  if (parsed.success) return null;
  return Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe("extraRulesSettingsSchema", () => {
  it("is empty by default", () => {
    expect(schema.parse({})).toEqual({ minSwimDistanceM: null, extraSlowestPaceSecPer100m: null });
    expect(schema.parse({ minSwimDistanceM: "", extraSlowestPace: " " })).toEqual({
      minSwimDistanceM: null,
      extraSlowestPaceSecPer100m: null,
    });
  });

  it("refuses 5:00 when the realistic slowest is 5:00 and shows it; accepts 4:59", () => {
    expect(errorsOf({ extraSlowestPace: "5:00" })).toEqual({
      extraSlowestPace: "EXTRA_PACE_NOT_STRICTER",
      realisticSlowestPace: "5:00",
    });
    expect(errorsOf({ extraSlowestPace: "06:10" })?.extraSlowestPace).toBe(
      "EXTRA_PACE_NOT_STRICTER",
    );
    expect(schema.parse({ extraSlowestPace: "4:59" })).toMatchObject({
      extraSlowestPaceSecPer100m: 299,
    });
  });

  it("refuses malformed paces", () => {
    for (const extraSlowestPace of ["abc", "4:60", "0:00", -5, 1.5, {}])
      expect(errorsOf({ extraSlowestPace })).toEqual({ extraSlowestPace: "PACE_INVALID" });
  });

  it("refuses minimum distance 0, negative, malformed and not below the longest swim", () => {
    expect(errorsOf({ minSwimDistanceM: 0 })).toEqual({
      minSwimDistanceM: "DISTANCE_NOT_POSITIVE",
    });
    expect(errorsOf({ minSwimDistanceM: "-5" })).toEqual({ minSwimDistanceM: "DISTANCE_INVALID" });
    expect(errorsOf({ minSwimDistanceM: 1.5 })).toEqual({ minSwimDistanceM: "DISTANCE_INVALID" });
    expect(errorsOf({ minSwimDistanceM: 30000 })).toEqual({
      minSwimDistanceM: "EXTRA_DISTANCE_TOO_LARGE",
    });
    expect(schema.parse({ minSwimDistanceM: "500" }).minSwimDistanceM).toBe(500);
    expect(schema.parse({ minSwimDistanceM: 29999 }).minSwimDistanceM).toBe(29999);
  });

  it("refuses unknown fields", () => {
    expect(schema.safeParse({ other: 1 }).success).toBe(false);
  });
});
