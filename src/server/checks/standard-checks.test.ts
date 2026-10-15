import { describe, expect, it } from "vitest";
import { DEFAULT_SWIM_LIMITS } from "@/lib/swim-limits";
import { evaluateSwim, type CheckedSwim, type CheckTournament } from "./standard-checks";
import { REASON_CODES } from "./reasons";

// Season: 1 Nov 06:00 to 30 Nov 22:00 Vietnam time (UTC+7).
const tournament: CheckTournament = {
  seasonStartAt: new Date("2026-11-01T06:00:00+07:00"),
  seasonEndAt: new Date("2026-11-30T22:00:00+07:00"),
  ...DEFAULT_SWIM_LIMITS,
};

/** A 1 km swim at the given pace (seconds per 100 m), started 2 Nov 07:00 Vietnam time. */
function swimAt(paceSecPer100m: number, overrides: Partial<CheckedSwim> = {}): CheckedSwim {
  return {
    isSwim: true,
    startedAt: new Date("2026-11-02T07:00:00+07:00"),
    distanceM: 1000,
    durationS: paceSecPer100m * 10,
    ...overrides,
  };
}

const VERIFIED = { status: "VERIFIED", reasons: [] };

describe("evaluateSwim", () => {
  it("verifies a swim that passes every check, pool or open water alike", () => {
    expect(evaluateSwim(swimAt(120), tournament)).toEqual(VERIFIED);
  });

  it("flags a file that is not a swim (NOT_A_SWIM)", () => {
    expect(evaluateSwim(swimAt(120, { isSwim: false }), tournament)).toEqual({
      status: "FLAGGED",
      reasons: ["NOT_A_SWIM"],
    });
  });

  it("flags a swim with no distance (NO_DISTANCE) and skips pace and distance checks", () => {
    for (const distanceM of [0, -5, Number.NaN, null]) {
      expect(evaluateSwim(swimAt(120, { distanceM }), tournament)).toEqual({
        status: "FLAGGED",
        reasons: ["NO_DISTANCE"],
      });
    }
  });

  describe("season boundary by start time (season starts 06:00 VN)", () => {
    it("flags a swim started at 05:30 on the first day", () => {
      const startedAt = new Date("2026-11-01T05:30:00+07:00");
      expect(evaluateSwim(swimAt(120, { startedAt }), tournament)).toEqual({
        status: "FLAGGED",
        reasons: ["OUTSIDE_SEASON"],
      });
    });
    it("passes a swim started at exactly 06:00", () => {
      const startedAt = new Date("2026-11-01T06:00:00+07:00");
      expect(evaluateSwim(swimAt(120, { startedAt }), tournament)).toEqual(VERIFIED);
    });
    it("passes a swim started exactly at the season end and flags one a second later", () => {
      const end = tournament.seasonEndAt.getTime();
      expect(evaluateSwim(swimAt(120, { startedAt: new Date(end) }), tournament)).toEqual(VERIFIED);
      expect(evaluateSwim(swimAt(120, { startedAt: new Date(end + 1000) }), tournament)).toEqual({
        status: "FLAGGED",
        reasons: ["OUTSIDE_SEASON"],
      });
    });
    it("flags an invalid start time (fails closed)", () => {
      const startedAt = new Date(Number.NaN);
      expect(evaluateSwim(swimAt(120, { startedAt }), tournament).reasons).toEqual([
        "OUTSIDE_SEASON",
      ]);
    });
  });

  describe("default limits", () => {
    it("flags 1:04 per 100 m as too fast and accepts 1:05", () => {
      expect(evaluateSwim(swimAt(64), tournament)).toEqual({
        status: "FLAGGED",
        reasons: ["PACE_TOO_FAST"],
      });
      expect(evaluateSwim(swimAt(65), tournament)).toEqual(VERIFIED);
    });
    it("accepts 5:00 per 100 m and flags 5:01 as too slow", () => {
      expect(evaluateSwim(swimAt(300), tournament)).toEqual(VERIFIED);
      expect(evaluateSwim(swimAt(301), tournament)).toEqual({
        status: "FLAGGED",
        reasons: ["PACE_TOO_SLOW"],
      });
    });
    it("accepts 30 km and flags 30.1 km as too long", () => {
      const at30 = { distanceM: 30_000, durationS: 300 * 120 };
      const at30_1 = { distanceM: 30_100, durationS: 301 * 120 };
      expect(evaluateSwim(swimAt(120, at30), tournament)).toEqual(VERIFIED);
      expect(evaluateSwim(swimAt(120, at30_1), tournament)).toEqual({
        status: "FLAGGED",
        reasons: ["DISTANCE_TOO_LONG"],
      });
    });
    it("accepts a swim exactly on the slowest limit at a non-round distance (201 m in 10:03)", () => {
      // 603 / 2.01 is 300.00000000000006 in floating point: the limit must still be inclusive.
      expect(evaluateSwim(swimAt(300, { distanceM: 201, durationS: 603 }), tournament)).toEqual(
        VERIFIED,
      );
      expect(evaluateSwim(swimAt(300, { distanceM: 201, durationS: 604 }), tournament)).toEqual({
        status: "FLAGGED",
        reasons: ["PACE_TOO_SLOW"],
      });
    });
    it("accepts a swim exactly on the fastest limit at a non-round distance (220 m in 2:01)", () => {
      // With a 0:55 limit, 121 / 2.2 is 54.99999999999999 in floating point.
      const fast55 = { ...tournament, fastestPaceSecPer100m: 55 };
      expect(evaluateSwim(swimAt(55, { distanceM: 220, durationS: 121 }), fast55)).toEqual(
        VERIFIED,
      );
      expect(evaluateSwim(swimAt(55, { distanceM: 220, durationS: 120 }), fast55)).toEqual({
        status: "FLAGGED",
        reasons: ["PACE_TOO_FAST"],
      });
    });
    it("flags a zero or invalid duration as too fast (fails closed)", () => {
      for (const durationS of [0, Number.NaN]) {
        expect(evaluateSwim(swimAt(120, { durationS }), tournament).reasons).toEqual([
          "PACE_TOO_FAST",
        ]);
      }
    });
  });

  it("lists every failing check, not only the first", () => {
    const swim: CheckedSwim = {
      isSwim: false,
      startedAt: new Date("2026-12-05T07:00:00+07:00"),
      distanceM: 31_000,
      durationS: 31_000 / 100,
    };
    expect(evaluateSwim(swim, tournament)).toEqual({
      status: "FLAGGED",
      reasons: ["NOT_A_SWIM", "OUTSIDE_SEASON", "PACE_TOO_FAST", "DISTANCE_TOO_LONG"],
    });
  });

  it("uses each tournament's own limits: 4:30 is verified at slowest 5:00, flagged at 4:00", () => {
    const relaxed = { ...tournament, slowestPaceSecPer100m: 300 };
    const strict = { ...tournament, slowestPaceSecPer100m: 240 };
    const swim = swimAt(270);
    expect(evaluateSwim(swim, relaxed)).toEqual(VERIFIED);
    expect(evaluateSwim(swim, strict)).toEqual({ status: "FLAGGED", reasons: ["PACE_TOO_SLOW"] });
  });

  it("only returns known reason codes", () => {
    const swim: CheckedSwim = {
      isSwim: false,
      startedAt: new Date(0),
      distanceM: null,
      durationS: 0,
    };
    for (const reason of evaluateSwim(swim, tournament).reasons) {
      expect(REASON_CODES).toContain(reason);
    }
  });
});
