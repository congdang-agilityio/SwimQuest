import type { ArtAsset } from "@/lib/art/route01-art";

/*
 * Temporary art for the voyage screen, cut from the stakeholder mockup by
 * scripts/art/cut_screen_voyage.py. Swap for the shared group assets (map: G3, ships: G2) once
 * they are on main.
 */

/** Route 01 map scene, 18:7, painted pins and name pills at the anchors in map-anchors.json. */
export const VOYAGE_MAP_ART: ArtAsset = {
  key: "voyage-map",
  path: "/art/mockup/screen-voyage/map-route01.webp",
  source: "cut-out",
  replacementNeed: "18:7 Route 01 map scene, destinations at the anchors in map-anchors.json",
};

/** The team's ship on the map and on the route bar. */
export const VOYAGE_SHIP_ART: ArtAsset = {
  key: "voyage-ship",
  path: "/art/mockup/screen-voyage/ship-map.png",
  source: "cut-out",
  replacementNeed: "Transparent ship, bow facing right, readable at 32 px, no text",
};
