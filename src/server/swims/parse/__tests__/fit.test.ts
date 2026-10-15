import { describe, expect, it } from "vitest";
import { parseFit } from "../fit";
import { buildFit } from "./fit-builder";
import { ParseError } from "../types";

const start = new Date("2026-06-03T06:30:00Z");
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ParseError ? e.code : "OTHER";
  }
  return "NONE";
};

describe("parseFit", () => {
  it("reads a pool swim", async () => {
    const s = await parseFit(
      buildFit({ sport: 5, subSport: 17, start, timerS: 1800, distanceM: 1000 }),
    );
    expect(s.startedAt).toEqual(start);
    expect(s.endedAt.toISOString()).toBe("2026-06-03T07:00:00.000Z");
    expect(s.durationS).toBe(1800);
    expect(s.distanceM).toBe(1000);
    expect(s.swimType).toBe("POOL");
    expect(s.sport).toBe("lap_swimming");
    expect(s.isSwim).toBe(true);
    expect(s.track).toEqual([]);
  });

  it("reads an open-water swim with GPS records", async () => {
    const at = new Date(start.getTime() + 60_000);
    const s = await parseFit(
      buildFit({
        sport: 5,
        subSport: 18,
        start,
        timerS: 900,
        distanceM: 750,
        points: [
          { lat: 10, lon: 106, at: start },
          { lat: 10.001, lon: 106.002, at },
        ],
      }),
    );
    expect(s.swimType).toBe("OPEN_WATER");
    expect(s.isSwim).toBe(true);
    expect(s.track).toHaveLength(2);
    expect(s.track[1]!.lat).toBeCloseTo(10.001, 4);
    expect(s.track[1]!.lon).toBeCloseTo(106.002, 4);
    expect(s.track[1]!.time).toEqual(at);
  });

  it("reads a running file as not a swim", async () => {
    const s = await parseFit(
      buildFit({ sport: 1, subSport: 0, start, timerS: 1200, distanceM: 4000 }),
    );
    expect(s.isSwim).toBe(false);
    expect(s.swimType).toBe("UNKNOWN");
    expect(s.sport).toBe("running");
  });

  it("reports a FIT without a session as UNREADABLE_FILE", async () => {
    expect(
      await codeOf(parseFit(buildFit({ sport: 5, subSport: 17, start, withSession: false }))),
    ).toBe("UNREADABLE_FILE");
  });

  it("reports a corrupt FIT as UNREADABLE_FILE", async () => {
    const good = buildFit({ sport: 5, subSport: 17, start, timerS: 60, distanceM: 50 });
    expect(await codeOf(parseFit(good.subarray(0, 14)))).toBe("UNREADABLE_FILE");
    expect(
      await codeOf(parseFit(Buffer.concat([good.subarray(0, 12), Buffer.alloc(40, 0xff)]))),
    ).toBe("UNREADABLE_FILE");
  });

  it("reports a swim with no distance as NO_DISTANCE", async () => {
    expect(await codeOf(parseFit(buildFit({ sport: 5, subSport: 17, start, timerS: 60 })))).toBe(
      "NO_DISTANCE",
    );
  });
});
