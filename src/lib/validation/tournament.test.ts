import { describe, expect, it } from "vitest";
import { parseTournamentDraft, tournamentDraftSchema } from "./tournament";

const valid = {
  name: "  Autumn Expedition ",
  description: "Swim to Ly Son together",
  seasonStart: { date: "2026-11-01", time: "07:00" },
  seasonEnd: { date: "2026-11-30", time: "23:59" },
  routeId: "route01",
  routeDistanceKm: "123.45",
};

function errorsFor(patch: Record<string, unknown>) {
  const result = parseTournamentDraft({ ...valid, ...patch });
  return result.ok ? {} : result.errors;
}

describe("tournament draft validation", () => {
  it("accepts valid input, trims text and converts times and distance", () => {
    const result = parseTournamentDraft(valid);

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Autumn Expedition",
        description: "Swim to Ly Son together",
        seasonStartAt: new Date("2026-11-01T00:00:00.000Z"),
        seasonEndAt: new Date("2026-11-30T16:59:00.000Z"),
        routeId: "route01",
        routeDistanceM: 123450,
      },
    });
  });

  it("is a plain Zod schema shared with the form", () => {
    expect(tournamentDraftSchema.safeParse({ ...valid, routeDistanceKm: 1.5 }).success).toBe(true);
  });

  it.each([
    [{ name: undefined }, { name: "NAME_REQUIRED" }],
    [{ name: "   " }, { name: "NAME_REQUIRED" }],
    [{ name: "a".repeat(81) }, { name: "NAME_TOO_LONG" }],
    [{ description: "" }, { description: "DESCRIPTION_REQUIRED" }],
    [{ description: "a".repeat(2001) }, { description: "DESCRIPTION_TOO_LONG" }],
    [
      { seasonStart: { date: "2026-02-30", time: "07:00" } },
      { seasonStart: "SEASON_START_INVALID" },
    ],
    [{ seasonStart: undefined }, { seasonStart: "SEASON_START_INVALID" }],
    [{ seasonStart: { date: 5, time: "07:00" } }, { seasonStart: "SEASON_START_INVALID" }],
    [{ seasonEnd: { date: "2026-11-30", time: "24:00" } }, { seasonEnd: "SEASON_END_INVALID" }],
    [{ routeId: "route99" }, { routeId: "ROUTE_UNKNOWN" }],
    [{ routeId: undefined }, { routeId: "ROUTE_UNKNOWN" }],
    [{ routeDistanceKm: "" }, { routeDistanceKm: "ROUTE_DISTANCE_REQUIRED" }],
    [{ routeDistanceKm: undefined }, { routeDistanceKm: "ROUTE_DISTANCE_REQUIRED" }],
    [{ routeDistanceKm: "abc" }, { routeDistanceKm: "ROUTE_DISTANCE_INVALID" }],
    [{ routeDistanceKm: Number.NaN }, { routeDistanceKm: "ROUTE_DISTANCE_INVALID" }],
    [{ routeDistanceKm: "0" }, { routeDistanceKm: "ROUTE_DISTANCE_NOT_POSITIVE" }],
    [{ routeDistanceKm: 0 }, { routeDistanceKm: "ROUTE_DISTANCE_NOT_POSITIVE" }],
    [{ routeDistanceKm: "-5" }, { routeDistanceKm: "ROUTE_DISTANCE_NOT_POSITIVE" }],
    [{ routeDistanceKm: "1.234" }, { routeDistanceKm: "ROUTE_DISTANCE_TOO_PRECISE" }],
    [{ routeDistanceKm: 10000.01 }, { routeDistanceKm: "ROUTE_DISTANCE_TOO_LARGE" }],
  ])("rejects %o with %o", (patch, expected) => {
    expect(errorsFor(patch)).toEqual(expected);
  });

  it("rejects a season end before the start on the same day (06:00 vs 07:00)", () => {
    const errors = errorsFor({
      seasonStart: { date: "2026-11-01", time: "07:00" },
      seasonEnd: { date: "2026-11-01", time: "06:00" },
    });

    expect(errors).toEqual({ seasonEnd: "SEASON_END_NOT_AFTER_START" });
  });

  it("rejects a season end equal to the start", () => {
    const errors = errorsFor({
      seasonStart: { date: "2026-11-01", time: "07:00" },
      seasonEnd: { date: "2026-11-01", time: "07:00" },
    });

    expect(errors).toEqual({ seasonEnd: "SEASON_END_NOT_AFTER_START" });
  });

  it("accepts a season end one minute after the start", () => {
    const result = parseTournamentDraft({
      ...valid,
      seasonStart: { date: "2026-11-01", time: "07:00" },
      seasonEnd: { date: "2026-11-01", time: "07:01" },
    });

    expect(result.ok).toBe(true);
  });

  it("accepts the smallest and largest distances and stores whole metres", () => {
    const small = parseTournamentDraft({ ...valid, routeDistanceKm: "0.01" });
    const large = parseTournamentDraft({ ...valid, routeDistanceKm: 10000 });

    expect(small.ok && small.data.routeDistanceM).toBe(10);
    expect(large.ok && large.data.routeDistanceM).toBe(10_000_000);
  });

  it("treats non-object input as all fields missing", () => {
    const result = parseTournamentDraft("nope");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.name).toBe("NAME_REQUIRED");
  });
});
