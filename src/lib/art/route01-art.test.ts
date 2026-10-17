import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { landmarkArt, ROUTE01_ART, shipArt } from "./route01-art";

describe("ROUTE01_ART", () => {
  it("lists the map, seven landmarks and three ships", () => {
    expect(ROUTE01_ART).toHaveLength(11);
    expect(ROUTE01_ART.filter((a) => a.key.startsWith("landmark-"))).toHaveLength(7);
    expect(ROUTE01_ART.filter((a) => a.key.startsWith("ship-"))).toHaveLength(3);
  });

  it("points every entry at a file that exists under public/", () => {
    for (const art of ROUTE01_ART) {
      expect(existsSync(path.join(process.cwd(), "public", art.path)), art.path).toBe(true);
      if (art.fallbackPath) {
        expect(existsSync(path.join(process.cwd(), "public", art.fallbackPath))).toBe(true);
      }
    }
  });

  it("has unique keys, a valid source and a replacement need", () => {
    expect(new Set(ROUTE01_ART.map((a) => a.key)).size).toBe(ROUTE01_ART.length);
    for (const art of ROUTE01_ART) {
      expect(["cut-out", "vector"]).toContain(art.source);
      expect(art.replacementNeed.length).toBeGreaterThan(0);
    }
  });

  it("looks up landmarks by slug and ships by tier", () => {
    expect(landmarkArt("ly_son")?.path).toBe("/art/mockup/landmarks/landmark-07-ly-son.png");
    expect(landmarkArt("ly_son")?.fallbackPath).toBe("/art/route01/landmarks/ly_son.svg");
    expect(shipArt(2)?.path).toBe("/art/ships/ship-tier-2.svg");
    expect(landmarkArt("nowhere")).toBeUndefined();
    expect(shipArt(9)).toBeUndefined();
  });
});
