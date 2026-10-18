import { mockupArt } from "@/lib/art/mockup-art";
import type { ArtAsset } from "@/lib/art/route01-art";

/** The Route 01 map art variants (stakeholder art, #727), by their registry keys (src/lib/routes/map-layout.ts). */
export function voyageMapArt(keys: { landscape: string; portrait: string }) {
  return { landscape: mockupArt(keys.landscape), portrait: mockupArt(keys.portrait) };
}

/** Compass rose from the G3 map elements (WebP, PNG fallback); undefined until it is registered. */
export function compassArt(): ArtAsset | undefined {
  const art = mockupArt("compass-rose") ?? mockupArt("map/compass-rose");
  return (
    art && {
      key: art.key,
      path: art.webp,
      fallbackPath: art.file,
      source: "cut-out",
      replacementNeed: "Square compass rose, no letters",
    }
  );
}
