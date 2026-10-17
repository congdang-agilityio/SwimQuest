import { mockupArt } from "@/lib/art/mockup-art";
import type { ArtAsset } from "@/lib/art/route01-art";

/*
 * Temporary art for the voyage screen, cut from the stakeholder mockup by
 * scripts/art/cut_screen_voyage.py. Swap for the shared group assets once they
 * exist (no group has a top-down Route 01 map scene yet; ships: G2).
 */

/** Route 01 map scene, 18:7, painted pins and name pills at the anchors in map-anchors.json. */
export const VOYAGE_MAP_ART: ArtAsset = {
  key: "voyage-map",
  path: "/art/mockup/screen-voyage/map-route01.webp",
  source: "cut-out",
  replacementNeed: "18:7 Route 01 map scene, destinations at the anchors in map-anchors.json",
};

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
