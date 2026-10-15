import { describe, expect, it } from "vitest";
import { countDistance } from "@/lib/scoring/distance-points";

const defaults = {
  longestSwimCountedM: 10_000,
  dailyLimitM: 10_000,
  alreadyCountedTodayM: 0,
  pointsPerKm: 10,
};

describe("countDistance", () => {
  it("2,450 m with defaults is 24 points", () => {
    expect(countDistance({ ...defaults, distanceM: 2450 })).toEqual({ countedM: 2450, points: 24 });
  });

  it("caps a 12 km swim at the 10 km longest swim", () => {
    expect(countDistance({ ...defaults, distanceM: 12_000 })).toEqual({
      countedM: 10_000,
      points: 100,
    });
  });

  it("limits 4 km to the 2 km left of the daily limit", () => {
    expect(countDistance({ ...defaults, distanceM: 4000, alreadyCountedTodayM: 8000 })).toEqual({
      countedM: 2000,
      points: 20,
    });
  });

  it("counts nothing when the daily allowance is used up or exceeded", () => {
    expect(countDistance({ ...defaults, distanceM: 4000, alreadyCountedTodayM: 10_000 })).toEqual({
      countedM: 0,
      points: 0,
    });
    expect(countDistance({ ...defaults, distanceM: 4000, alreadyCountedTodayM: 12_000 })).toEqual({
      countedM: 0,
      points: 0,
    });
  });

  it("rejects negative or non-integer input", () => {
    expect(() => countDistance({ ...defaults, distanceM: -1 })).toThrow(RangeError);
    expect(() => countDistance({ ...defaults, distanceM: 100, alreadyCountedTodayM: -5 })).toThrow(
      RangeError,
    );
    expect(() => countDistance({ ...defaults, distanceM: 100, dailyLimitM: -1 })).toThrow(
      RangeError,
    );
    expect(() => countDistance({ ...defaults, distanceM: 100, longestSwimCountedM: -1 })).toThrow(
      RangeError,
    );
    expect(() => countDistance({ ...defaults, distanceM: 100, pointsPerKm: -1 })).toThrow(
      RangeError,
    );
    expect(() => countDistance({ ...defaults, distanceM: 10.5 })).toThrow(RangeError);
  });
});
