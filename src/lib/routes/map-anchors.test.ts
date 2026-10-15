import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { route01 } from "./route01";

const dir = join(process.cwd(), "public/art/route01");
const anchors = JSON.parse(readFileSync(join(dir, "map-anchors.json"), "utf8"));

describe("route01 map anchors", () => {
  it("has every destination slug with x and y in 0..100", () => {
    const slugs = route01.destinations.map((d) => d.slug);
    expect(Object.keys(anchors.anchors).sort()).toEqual([...slugs].sort());
    expect(slugs).toHaveLength(7);
    for (const slug of slugs) {
      const { x, y } = anchors.anchors[slug];
      for (const v of [x, y]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it("puts Ly Son offshore to the south-east of every other destination", () => {
    const ly = anchors.anchors.ly_son;
    for (const [slug, p] of Object.entries<{ x: number; y: number }>(anchors.anchors)) {
      if (slug === "ly_son") continue;
      expect(ly.x).toBeGreaterThan(p.x);
      expect(ly.y).toBeGreaterThan(p.y);
    }
  });

  it("documents the aspect ratio", () => {
    expect(anchors.aspectRatio).toBe("16:10");
  });

  it("ships a small map without text", () => {
    const svg = readFileSync(join(dir, "map.svg"), "utf8");
    expect(svg.length).toBeLessThan(150 * 1024);
    expect(svg).not.toMatch(/<text|<tspan/);
  });
});
