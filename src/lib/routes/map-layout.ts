import route01Map from "../../../public/art/route01/map-anchors.json";
import type { MapPoint } from "./path-position";

/** Where a destination's name sits around its numbered pin. */
export type LabelSide =
  | "right"
  | "left"
  | "above"
  | "below"
  | "above-right"
  | "above-left"
  | "below-right"
  | "below-left";

/** One map art variant: its aspect, registry key, anchors (percent of the map box) and name sides. */
export type MapVariant = {
  /** Width / height of the art. */
  aspect: number;
  /** CSS aspect-ratio of the map box, e.g. "1920 / 819". */
  aspectRatio: string;
  /** Registry key of the art (src/lib/art/mockup-art.ts). */
  art: string;
  anchors: Record<string, MapPoint>;
  labels: Record<string, LabelSide>;
};

/** Wide art for tablets and desktops, tall art for phones (below 768 px). */
export type MapLayout = { landscape: MapVariant; portrait: MapVariant };

type RawVariant = {
  width: number;
  height: number;
  anchors: Record<string, MapPoint>;
  labels: Record<string, string>;
};

function variant(raw: RawVariant, art: string): MapVariant {
  return {
    aspect: raw.width / raw.height,
    aspectRatio: `${raw.width} / ${raw.height}`,
    art,
    anchors: raw.anchors,
    labels: raw.labels as Record<string, LabelSide>,
  };
}

const layouts: Record<string, MapLayout> = {
  route01: {
    landscape: variant(route01Map, "map/route01-landscape"),
    portrait: variant(route01Map.portrait, "map/route01-portrait"),
  },
};

export function mapLayout(routeId: string): MapLayout | undefined {
  return layouts[routeId];
}

/**
 * Width / height of the Route 01 landscape map. Anchors are percent of the map box, so x counts
 * this much for lengths. The landscape anchors are the canonical ones: a destination's share of
 * the route (and so when a team passes it) is measured on them.
 */
export const MAP_ASPECT = route01Map.width / route01Map.height;
