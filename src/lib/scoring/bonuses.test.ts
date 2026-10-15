import { describe, expect, it } from "vitest";
import { PLATFORM_POINT_VALUES, firstSwimBonus, longSwimBonus } from "./bonuses";

describe("longSwimBonus", () => {
  it.each([
    [0, 0],
    [999, 0],
    [1000, 10],
    [2999, 10],
    [3000, 25],
    [10000, 25],
  ])("%i m -> %i", (m, pts) => {
    expect(longSwimBonus(m, PLATFORM_POINT_VALUES)).toBe(pts);
  });

  it("uses custom values", () => {
    const v = { ...PLATFORM_POINT_VALUES, longSwimTier1M: 1500, longSwimTier1Points: 15 };
    expect(longSwimBonus(1499, v)).toBe(0);
    expect(longSwimBonus(1500, v)).toBe(15);
    expect(longSwimBonus(3000, v)).toBe(25);
  });

  it("rejects invalid distances", () => {
    expect(() => longSwimBonus(-1)).toThrow(RangeError);
    expect(() => longSwimBonus(NaN)).toThrow(RangeError);
  });
});

describe("firstSwimBonus", () => {
  it("returns the first-swim points", () => {
    expect(firstSwimBonus(PLATFORM_POINT_VALUES)).toBe(20);
    expect(firstSwimBonus({ firstSwimPoints: 30 })).toBe(30);
  });
});

describe("PLATFORM_POINT_VALUES", () => {
  it("holds the BR-29 defaults", () => {
    expect(PLATFORM_POINT_VALUES).toMatchObject({
      multiplier2DaysPct: 110,
      multiplier3DaysPct: 120,
      multiplierStreakStepPct: 5,
      multiplierMaxPct: 140,
      pointsPerKm: 10,
    });
  });
});
