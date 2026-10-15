import { describe, expect, it } from "vitest";
import { activeDays, extraPoints, weeklyMultiplierPct } from "./weekly-multiplier";
import { previousWeekStart, vnLocalToUtc, vnWeekRange, vnWeekStart } from "@/lib/time/vn";

describe("vn weeks", () => {
  it("Sunday 23:59 and Monday 00:00 Vietnam time are in different weeks", () => {
    expect(vnWeekStart(vnLocalToUtc("2026-10-18", "23:59"))).toBe("2026-10-12");
    expect(vnWeekStart(vnLocalToUtc("2026-10-19", "00:00"))).toBe("2026-10-19");
  });
  it("range is Monday 00:00 to next Monday 00:00 and previous week steps back", () => {
    const r = vnWeekRange("2026-10-12");
    expect(r.start).toEqual(vnLocalToUtc("2026-10-12", "00:00"));
    expect(r.end).toEqual(vnLocalToUtc("2026-10-19", "00:00"));
    expect(previousWeekStart("2026-10-12")).toBe("2026-10-05");
    expect(() => vnWeekRange("2026-10-13")).toThrow();
  });
});

describe("activeDays", () => {
  const swim = (d: string, t: string, distanceM: number) => ({
    startedAt: vnLocalToUtc(d, t),
    distanceM,
  });
  it("counts distinct Vietnam days with a swim of 500 m or more", () => {
    expect(
      activeDays([
        swim("2026-10-12", "06:00", 500),
        swim("2026-10-12", "18:00", 1000),
        swim("2026-10-13", "06:00", 499),
        swim("2026-10-14", "00:30", 800),
      ]),
    ).toBe(2);
  });
});

describe("weeklyMultiplierPct", () => {
  const m = (activeDays: number, previousThreePlusStreak = 0) =>
    weeklyMultiplierPct({ activeDays, previousThreePlusStreak });
  it("handles days", () => {
    expect(m(0)).toBe(100);
    expect(m(1)).toBe(100);
    expect(m(2, 5)).toBe(110);
    expect(m(3)).toBe(120);
    expect(m(7)).toBe(120);
  });
  it("grows with the streak and caps at 140", () => {
    expect(m(3, 1)).toBe(125);
    expect(m(3, 3)).toBe(135);
    expect(m(3, 4)).toBe(140);
    expect(m(3, 10)).toBe(140);
  });
  it("rejects bad input", () => {
    expect(() => m(-1)).toThrow(RangeError);
    expect(() => m(3, -1)).toThrow(RangeError);
  });
});

describe("extraPoints", () => {
  it("64 distance points x 1.20 gives 13 extra, 77 total (12.8 rounds to nearest, Q-43)", () => {
    expect(extraPoints(64, 120)).toBe(13);
    expect(64 + extraPoints(64, 120)).toBe(77);
  });
  it("rounds half up and returns 0 at 100", () => {
    expect(extraPoints(15, 110)).toBe(2);
    expect(extraPoints(14, 110)).toBe(1);
    expect(extraPoints(50, 100)).toBe(0);
    expect(() => extraPoints(-1, 110)).toThrow(RangeError);
  });
  it("rejects a pct that is not an integer of 100 or more", () => {
    expect(() => extraPoints(64, Number.NaN)).toThrow(RangeError);
    expect(() => extraPoints(64, 99)).toThrow(RangeError);
    expect(() => extraPoints(64, 110.5)).toThrow(RangeError);
  });
});
