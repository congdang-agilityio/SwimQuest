import { describe, expect, it } from "vitest";
import { toOwnerSwimDto, type SwimForDto } from "./swim-dto";

const tournament = (name: string) => ({
  name,
  seasonStartAt: new Date("2026-05-31T17:00:00Z"),
  seasonEndAt: new Date("2026-08-31T16:59:00Z"),
  fastestPaceSecPer100m: 65,
  slowestPaceSecPer100m: 300,
  longestRealisticSwimM: 30000,
});
const rules = {
  seasonStartAt: "2026-05-31T17:00:00.000Z",
  seasonEndAt: "2026-08-31T16:59:00.000Z",
  fastestPaceS: 65,
  slowestPaceS: 300,
  longestSwimM: 30000,
};

const swim = (over: Partial<SwimForDto> = {}): SwimForDto => ({
  id: "s1",
  userId: "u1",
  source: "GPX",
  fileSha256: "a".repeat(64),
  originalFilename: "swim.gpx",
  startedAt: new Date("2026-06-01T23:30:00Z"),
  endedAt: new Date("2026-06-02T00:00:00Z"),
  distanceM: 1500,
  durationS: 1800,
  swimType: "OPEN_WATER",
  sport: "swimming",
  isSwim: true,
  duplicateOfId: null,
  track: [{ lat: 10, lon: 106, time: "2026-06-01T23:30:00.000Z" }],
  createdAt: new Date("2026-06-02T01:00:00Z"),
  ...over,
});

describe("toOwnerSwimDto", () => {
  it("returns the swim's facts in Vietnam time with a computed pace", () => {
    expect(toOwnerSwimDto(swim())).toEqual({
      id: "s1",
      source: "GPX",
      startedAt: "2026-06-01T23:30:00.000Z",
      date: "2026-06-02",
      startTime: "06:30",
      distanceM: 1500,
      durationS: 1800,
      pacePer100mS: 120,
      swimType: "OPEN_WATER",
      isSwim: true,
      isDuplicate: false,
      results: [],
    });
  });

  it("lists each tournament's status and reason codes, and ignores malformed reasons", () => {
    const results = [
      {
        tournamentId: "t1",
        status: "VERIFIED" as const,
        reasons: [],
        tournament: tournament("One"),
      },
      {
        tournamentId: "t2",
        status: "FLAGGED" as const,
        reasons: ["PACE_TOO_SLOW", 7, null],
        tournament: tournament("Two"),
      },
      { tournamentId: "t3", status: "FLAGGED" as const, reasons: "x", tournament: tournament("3") },
    ];
    expect(toOwnerSwimDto({ ...swim(), results }).results).toEqual([
      { tournamentId: "t1", tournamentName: "One", status: "VERIFIED", reasons: [], rules },
      {
        tournamentId: "t2",
        tournamentName: "Two",
        status: "FLAGGED",
        reasons: ["PACE_TOO_SLOW"],
        rules,
      },
      { tournamentId: "t3", tournamentName: "3", status: "FLAGGED", reasons: [], rules },
    ]);
  });

  it("never exposes the track, the file hash, the owner or the file name", () => {
    const dto = toOwnerSwimDto(swim());
    for (const key of ["track", "fileSha256", "userId", "originalFilename", "duplicateOfId"]) {
      expect(dto).not.toHaveProperty(key);
    }
    expect(JSON.stringify(dto)).not.toContain("106");
  });

  it("rounds the pace to whole seconds and gives null for zero distance", () => {
    expect(toOwnerSwimDto(swim({ distanceM: 700, durationS: 1000 })).pacePer100mS).toBe(143);
    expect(toOwnerSwimDto(swim({ distanceM: 0 })).pacePer100mS).toBeNull();
  });

  it("marks a duplicate swim and a non-swim activity", () => {
    const dto = toOwnerSwimDto(swim({ duplicateOfId: "s0", isSwim: false }));
    expect(dto.isDuplicate).toBe(true);
    expect(dto.isSwim).toBe(false);
  });
});
