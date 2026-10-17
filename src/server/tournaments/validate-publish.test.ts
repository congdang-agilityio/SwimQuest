import { describe, expect, it } from "vitest";
import { getRoute } from "@/lib/routes";
import { DEFAULT_SWIM_LIMITS, SWIM_LIMIT_BOUNDS } from "@/lib/swim-limits";
import { validateForPublish, type PublishCandidate } from "./validate-publish";

const valid: PublishCandidate = {
  seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
  seasonEndAt: new Date("2026-11-30T23:59:00+07:00"),
  routeId: "route01",
  routeDistanceM: 100_000,
  visibility: "INVITE_ONLY",
  ...DEFAULT_SWIM_LIMITS,
};
const teams = [{ id: "team-1" }];

describe("validateForPublish", () => {
  it("returns no issues for a valid draft with a team", () => {
    expect(validateForPublish(valid, teams)).toEqual([]);
  });

  it("reports SEASON_END_NOT_AFTER_START when the end equals the start (date and time)", () => {
    const t = { ...valid, seasonEndAt: new Date(valid.seasonStartAt) };
    expect(validateForPublish(t, teams)).toEqual([
      { code: "SEASON_END_NOT_AFTER_START", field: "seasonEnd" },
    ]);
  });

  it("reports SEASON_END_NOT_AFTER_START when the end is one minute before the start", () => {
    const t = { ...valid, seasonEndAt: new Date(valid.seasonStartAt.getTime() - 60_000) };
    expect(validateForPublish(t, teams)).toEqual([
      { code: "SEASON_END_NOT_AFTER_START", field: "seasonEnd" },
    ]);
  });

  it("accepts a season ending later on the same day as the start", () => {
    const t = { ...valid, seasonEndAt: new Date(valid.seasonStartAt.getTime() + 60_000) };
    expect(validateForPublish(t, teams)).toEqual([]);
  });

  it("reports SEASON_END_NOT_AFTER_START for invalid dates", () => {
    const t = { ...valid, seasonEndAt: new Date("not a date") };
    expect(validateForPublish(t, teams)).toEqual([
      { code: "SEASON_END_NOT_AFTER_START", field: "seasonEnd" },
    ]);
  });

  describe("REALISTIC_LIMITS_OUT_OF_BOUNDS", () => {
    const fields = Object.keys(SWIM_LIMIT_BOUNDS) as (keyof typeof SWIM_LIMIT_BOUNDS)[];

    it.each(fields)("accepts %s at both inclusive bounds", (field) => {
      const { min, max } = SWIM_LIMIT_BOUNDS[field];
      expect(validateForPublish({ ...valid, [field]: min }, teams)).toEqual([]);
      expect(validateForPublish({ ...valid, [field]: max }, teams)).toEqual([]);
    });

    it.each(fields)("reports %s below its minimum and above its maximum", (field) => {
      const { min, max } = SWIM_LIMIT_BOUNDS[field];
      const issue = [{ code: "REALISTIC_LIMITS_OUT_OF_BOUNDS", field }];
      expect(validateForPublish({ ...valid, [field]: min - 1 }, teams)).toEqual(issue);
      expect(validateForPublish({ ...valid, [field]: max + 1 }, teams)).toEqual(issue);
    });

    it("reports a non-finite limit", () => {
      expect(validateForPublish({ ...valid, fastestPaceSecPer100m: NaN }, teams)).toEqual([
        { code: "REALISTIC_LIMITS_OUT_OF_BOUNDS", field: "fastestPaceSecPer100m" },
      ]);
    });

    it("keeps the platform defaults inside the bounds", () => {
      for (const field of fields) {
        expect(DEFAULT_SWIM_LIMITS[field]).toBeGreaterThanOrEqual(SWIM_LIMIT_BOUNDS[field].min);
        expect(DEFAULT_SWIM_LIMITS[field]).toBeLessThanOrEqual(SWIM_LIMIT_BOUNDS[field].max);
      }
    });
  });

  it("reports ROUTE_MISSING for an empty or unknown route", () => {
    const issue = [{ code: "ROUTE_MISSING", field: "routeId" }];
    expect(validateForPublish({ ...valid, routeId: "" }, teams)).toEqual(issue);
    expect(validateForPublish({ ...valid, routeId: "route99" }, teams)).toEqual(issue);
  });

  it.each([0, -1000, null, undefined, NaN, 1.5])(
    "reports ROUTE_DISTANCE_INVALID for distance %s",
    (routeDistanceM) => {
      const t = { ...valid, routeDistanceM: routeDistanceM as number };
      expect(validateForPublish(t, teams)).toEqual([
        { code: "ROUTE_DISTANCE_INVALID", field: "routeDistanceKm" },
      ]);
    },
  );

  it("reports NO_TEAM when the tournament has no team", () => {
    expect(validateForPublish(valid, [])).toEqual([{ code: "NO_TEAM", field: "teams" }]);
  });

  it("reports every issue at once, in a stable order", () => {
    const t = {
      ...valid,
      seasonEndAt: valid.seasonStartAt,
      slowestPaceSecPer100m: 10_000,
      routeId: "",
      routeDistanceM: 0,
    };
    expect(validateForPublish(t, []).map((i) => i.code)).toEqual([
      "SEASON_END_NOT_AFTER_START",
      "REALISTIC_LIMITS_OUT_OF_BOUNDS",
      "ROUTE_MISSING",
      "ROUTE_DISTANCE_INVALID",
      "NO_TEAM",
    ]);
  });

  it("relies on Route 01 having exactly one finish", () => {
    const route = getRoute("route01");
    expect(route?.destinations.filter((d) => d.isFinish)).toHaveLength(1);
  });
});
