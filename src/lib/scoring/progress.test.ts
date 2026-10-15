import { describe, expect, it } from "vitest";
import { formatProgressPct, formatRouteKmLabel, routeProgress } from "@/lib/scoring/progress";

const base = { routeDistanceM: 100_000, pointsPerKm: 10 };

describe("routeProgress", () => {
  it("680 points on a 100 km route at 10 pts/km is 68.00%", () => {
    const p = routeProgress({ ...base, teamPoints: 680 });
    expect(p).toEqual({
      progressBp: 6800,
      routeKmReached: 68,
      routeKmTotal: 100,
      finished: false,
    });
    expect(formatRouteKmLabel(p)).toBe("68 / 100 route km");
    expect(formatProgressPct(p.progressBp)).toBe("68%");
  });

  it("caps at the end of the route and marks finished", () => {
    const p = routeProgress({ ...base, teamPoints: 1200 });
    expect(p.progressBp).toBe(10000);
    expect(p.routeKmReached).toBe(100);
    expect(p.finished).toBe(true);
  });

  it("is finished exactly at the route length", () => {
    expect(routeProgress({ ...base, teamPoints: 1000 }).finished).toBe(true);
    const almost = routeProgress({ ...base, teamPoints: 999 });
    expect(almost.finished).toBe(false);
    expect(almost.progressBp).toBe(9990);
  });

  it("zero points is zero progress", () => {
    expect(routeProgress({ ...base, teamPoints: 0 })).toEqual({
      progressBp: 0,
      routeKmReached: 0,
      routeKmTotal: 100,
      finished: false,
    });
  });

  it("handles a non-integer km route stored in metres (42.5 km)", () => {
    const p = routeProgress({
      teamPoints: 213,
      routeDistanceM: 42_500,
      pointsPerKm: 10,
    });
    // route = 425 points; 213 / 425 = 50.1176...% -> floored to 5011 bp
    expect(p.progressBp).toBe(5011);
    expect(p.routeKmReached).toBe(21.3);
    expect(p.routeKmTotal).toBe(42.5);
    expect(formatRouteKmLabel(p)).toBe("21.3 / 42.5 route km");
  });

  it("floors instead of rounding up", () => {
    const p = routeProgress({
      teamPoints: 2,
      routeDistanceM: 3_000,
      pointsPerKm: 1,
    });
    expect(p.progressBp).toBe(6666);
  });

  it("rejects invalid input", () => {
    expect(() => routeProgress({ ...base, teamPoints: -1 })).toThrow(RangeError);
    expect(() => routeProgress({ ...base, teamPoints: 1.5 })).toThrow(RangeError);
    expect(() => routeProgress({ ...base, routeDistanceM: 0, teamPoints: 1 })).toThrow(RangeError);
    expect(() => routeProgress({ ...base, pointsPerKm: 0, teamPoints: 1 })).toThrow(RangeError);
  });
});

describe("formatProgressPct", () => {
  it("rounds half up to one decimal and drops .0", () => {
    expect(formatProgressPct(6849)).toBe("68.5%");
    expect(formatProgressPct(6800)).toBe("68%");
    expect(formatProgressPct(6804)).toBe("68%");
    expect(formatProgressPct(6805)).toBe("68.1%");
    expect(formatProgressPct(0)).toBe("0%");
    expect(formatProgressPct(9999)).toBe("99.9%");
    expect(formatProgressPct(10000)).toBe("100%");
  });
});
