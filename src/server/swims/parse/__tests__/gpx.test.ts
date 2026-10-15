import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseGpx } from "../gpx";
import { ParseError } from "../types";

const load = (name: string) => readFileSync(join(__dirname, "fixtures", name));
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ParseError ? e.code : "OTHER";
  }
  return "NONE";
};

describe("parseGpx", () => {
  it("reads an open-water swim with a track", () => {
    const s = parseGpx(load("open-water.gpx"));
    expect(s.startedAt.toISOString()).toBe("2026-06-01T07:00:00.000Z");
    expect(s.endedAt.toISOString()).toBe("2026-06-01T07:02:30.000Z");
    expect(s.durationS).toBe(150);
    expect(s.distanceM).toBe(Math.round(s.distanceM));
    expect(s.distanceM).toBeGreaterThan(220);
    expect(s.distanceM).toBeLessThan(224); // 0.002 deg latitude ~ 222.4 m
    expect(s.swimType).toBe("OPEN_WATER");
    expect(s.sport).toBe("open_water_swimming");
    expect(s.isSwim).toBe(true);
    expect(s.track).toHaveLength(3);
    expect(s.track[1]).toEqual({ lat: 10.001, lon: 106, time: new Date("2026-06-01T07:01:00Z") });
  });

  it("uses the distance extension and total time when present", () => {
    const s = parseGpx(load("pool-with-distance.gpx"));
    expect(s.distanceM).toBe(1500);
    expect(s.durationS).toBe(2400);
    expect(s.startedAt.toISOString()).toBe("2026-06-02T18:00:00.000Z");
    expect(s.endedAt.toISOString()).toBe("2026-06-02T18:40:00.000Z");
    expect(s.swimType).toBe("POOL");
    expect(s.sport).toBe("lap_swimming");
    expect(s.isSwim).toBe(true);
    expect(s.track).toEqual([]);
  });

  it("reports a pool GPX without distance or track as NO_DISTANCE", () => {
    expect(codeOf(() => parseGpx(load("pool-no-distance.gpx")))).toBe("NO_DISTANCE");
  });

  it("reports a track with no movement and no distance extension as NO_DISTANCE", () => {
    const xml = `<gpx><trk><type>lap_swimming</type><trkseg>
      <trkpt lat="10" lon="106"><time>2026-06-01T07:00:00Z</time></trkpt>
      <trkpt lat="10" lon="106"><time>2026-06-01T07:30:00Z</time></trkpt></trkseg></trk></gpx>`;
    expect(codeOf(() => parseGpx(Buffer.from(xml)))).toBe("NO_DISTANCE");
  });

  it("rejects a GPX with no track (metadata only) as UNREADABLE_FILE", () => {
    const xml = `<gpx><metadata><time>2026-06-01T07:00:00Z</time></metadata></gpx>`;
    expect(codeOf(() => parseGpx(Buffer.from(xml)))).toBe("UNREADABLE_FILE");
  });

  it("rejects a route-only GPX as UNREADABLE_FILE", () => {
    const xml = `<gpx><metadata><time>2026-06-01T07:00:00Z</time></metadata>
      <rte><rtept lat="10" lon="106"/><rtept lat="10.01" lon="106"/></rte></gpx>`;
    expect(codeOf(() => parseGpx(Buffer.from(xml)))).toBe("UNREADABLE_FILE");
  });

  it("flags a running GPX as not a swim", () => {
    const s = parseGpx(load("running.gpx"));
    expect(s.isSwim).toBe(false);
    expect(s.sport).toBe("running");
    expect(s.swimType).toBe("UNKNOWN");
    expect(s.durationS).toBe(30);
    expect(s.distanceM).toBeGreaterThan(109);
    expect(s.distanceM).toBeLessThan(113);
  });

  it("treats plain swimming as UNKNOWN swim type", () => {
    const xml = `<gpx><trk><type>swimming</type><extensions><distance>400</distance></extensions>
      <trkseg><trkpt lat="1" lon="1"><time>2026-06-01T07:00:00Z</time></trkpt>
      <trkpt lat="1" lon="1"><time>2026-06-01T07:10:00Z</time></trkpt></trkseg></trk></gpx>`;
    const s = parseGpx(Buffer.from(xml));
    expect(s.swimType).toBe("UNKNOWN");
    expect(s.isSwim).toBe(true);
    expect(s.distanceM).toBe(400);
  });

  it.each(["malformed.gpx", "xxe.gpx", "not-gpx.xml"])("rejects %s as UNREADABLE_FILE", (name) => {
    expect(codeOf(() => parseGpx(load(name)))).toBe("UNREADABLE_FILE");
  });

  it("rejects empty and binary input as UNREADABLE_FILE", () => {
    expect(codeOf(() => parseGpx(Buffer.alloc(0)))).toBe("UNREADABLE_FILE");
    expect(codeOf(() => parseGpx(Buffer.from([0, 1, 2, 255, 254])))).toBe("UNREADABLE_FILE");
  });

  it("rejects a GPX with no timestamps as UNREADABLE_FILE", () => {
    const xml = `<gpx><trk><type>swimming</type><trkseg><trkpt lat="1" lon="1"/><trkpt lat="1" lon="2"/></trkseg></trk></gpx>`;
    expect(codeOf(() => parseGpx(Buffer.from(xml)))).toBe("UNREADABLE_FILE");
  });
});
