import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ART_DIR = path.join(process.cwd(), "public", "art");

function svgFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return svgFiles(full);
    return entry.name.endsWith(".svg") ? [full] : [];
  });
}

function rootAttr(svgTag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(svgTag)?.[1];
}

// ArtImage treats a completed <img> with naturalWidth 0 as failed. An SVG with only a viewBox
// has an engine-defined natural size, so every art SVG declares width/height explicitly.
describe("public/art SVGs", () => {
  const files = svgFiles(ART_DIR);

  it("finds the art files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [path.relative(ART_DIR, f), f]))(
    "%s declares width and height matching its viewBox",
    (_name, file) => {
      const svgTag = /<svg\b[^>]*>/.exec(readFileSync(file, "utf8"))?.[0] ?? "";
      const viewBox = rootAttr(svgTag, "viewBox")?.trim().split(/\s+/);
      expect(viewBox, "viewBox").toHaveLength(4);
      expect(rootAttr(svgTag, "width")).toBe(viewBox?.[2]);
      expect(rootAttr(svgTag, "height")).toBe(viewBox?.[3]);
      expect(Number(viewBox?.[2])).toBeGreaterThan(0);
      expect(Number(viewBox?.[3])).toBeGreaterThan(0);
    },
  );
});
