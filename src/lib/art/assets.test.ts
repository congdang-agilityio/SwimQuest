import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ASSETS, getAsset } from "./assets";

const publicDir = path.join(process.cwd(), "public");

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    return d.isDirectory() ? filesUnder(full) : [full];
  });
}

describe("asset registry", () => {
  it("points every entry at a file under public/", () => {
    for (const a of ASSETS) expect(existsSync(path.join(publicDir, a.path)), a.path).toBe(true);
  });

  it("has unique ids and paths", () => {
    expect(new Set(ASSETS.map((a) => a.id)).size).toBe(ASSETS.length);
    expect(new Set(ASSETS.map((a) => a.path)).size).toBe(ASSETS.length);
  });

  it("has an entry for every file under public/art/", () => {
    const listed = new Set(ASSETS.map((a) => a.path));
    for (const f of filesUnder(path.join(publicDir, "art"))) {
      const url = "/" + path.relative(publicDir, f).split(path.sep).join("/");
      expect(listed.has(url), url).toBe(true);
    }
  });

  it("fills every field of every entry", () => {
    for (const a of ASSETS) {
      expect(["concept-cut", "stand-in", "replaced"]).toContain(a.source);
      expect(a.shows, a.id).not.toBe("");
      expect(a.usedIn.length, a.id).toBeGreaterThan(0);
      expect(a.issues, a.id).not.toBe("");
      expect(a.spec.width).toBeGreaterThan(0);
      expect(a.spec.height).toBeGreaterThan(0);
      expect(a.spec.frames).toBeGreaterThanOrEqual(1);
      expect(typeof a.spec.transparent).toBe("boolean");
    }
  });

  it("looks an asset up by id", () => {
    expect(getAsset("ship-tier-1")?.path).toBe("/art/ships/ship-tier-1.svg");
    expect(getAsset("nope")).toBeUndefined();
  });
});
