import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSwimFile } from "../index";
import { buildFit } from "./fit-builder";
import { ParseError } from "../types";

const fixture = (n: string) => readFileSync(join(__dirname, "fixtures", n));
const code = async (b: Buffer, name = "x") => {
  try {
    await parseSwimFile(b, name);
  } catch (e) {
    return e instanceof ParseError ? e.code : "OTHER";
  }
  return "NONE";
};
const fit = () =>
  buildFit({
    sport: 5,
    subSport: 17,
    start: new Date("2026-06-03T06:30:00Z"),
    timerS: 600,
    distanceM: 400,
  });

describe("parseSwimFile", () => {
  it("detects FIT by header whatever the file name", async () => {
    const s = await parseSwimFile(fit(), "swim.gpx");
    expect(s.distanceM).toBe(400);
  });

  it("detects GPX by root element whatever the file name", async () => {
    const s = await parseSwimFile(fixture("open-water.gpx"), "swim.fit");
    expect(s.swimType).toBe("OPEN_WATER");
  });

  it("detects GPX after a BOM and XML declaration", async () => {
    const xml = Buffer.concat([Buffer.from("﻿"), fixture("open-water.gpx")]);
    expect((await parseSwimFile(xml, "a.gpx")).isSwim).toBe(true);
  });

  it("rejects a PNG as UNSUPPORTED_FILE", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001", "hex");
    expect(await code(png, "swim.fit")).toBe("UNSUPPORTED_FILE");
  });

  it("rejects a text file and non-GPX XML as UNSUPPORTED_FILE", async () => {
    expect(await code(Buffer.from("hello, this is just text"), "swim.gpx")).toBe(
      "UNSUPPORTED_FILE",
    );
    expect(await code(fixture("not-gpx.xml"), "swim.gpx")).toBe("UNSUPPORTED_FILE");
    expect(await code(Buffer.alloc(0))).toBe("UNSUPPORTED_FILE");
  });

  it("passes parser errors through (corrupt FIT, malformed GPX)", async () => {
    expect(await code(fit().subarray(0, 14))).toBe("UNREADABLE_FILE");
    expect(await code(fixture("malformed.gpx"))).toBe("UNREADABLE_FILE");
  });
});
