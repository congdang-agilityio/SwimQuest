import { getRoute, type Destination } from "./index";
import type { MapPoint } from "./path-position";

/** Map aspect ratio (18:7, map-anchors.json): anchors are percent of the map box, so x counts 18/7x for lengths. */
export const MAP_ASPECT = 18 / 7;

/**
 * Destinations a team crosses when its progress moves from `fromBp` to `toBp` (basis points of
 * the path from its start to the finish). A destination sits at its anchor's share of the path
 * length; it is crossed when that share is above `fromBp` and at most `toBp`. The start and the
 * finish never count (the finish has its own event). Moving backwards crosses nothing.
 */
export function destinationsPassed(
  routeId: string,
  anchors: Record<string, MapPoint>,
  startSlug: string,
  fromBp: number,
  toBp: number,
): Destination[] {
  const route = getRoute(routeId);
  if (!route || toBp <= fromBp) return [];
  const startIndex = route.destinations.findIndex((d) => d.slug === startSlug);
  if (startIndex < 0) return [];
  const path = route.destinations.slice(startIndex);
  if (path.some((d) => !anchors[d.slug])) return [];

  const cumulative = [0];
  for (let i = 1; i < path.length; i++) {
    const a = anchors[path[i - 1].slug];
    const b = anchors[path[i].slug];
    cumulative.push(cumulative[i - 1] + Math.hypot((b.x - a.x) * MAP_ASPECT, b.y - a.y));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return [];

  return path.filter((d, i) => {
    if (i === 0 || d.isFinish) return false;
    const bp = (cumulative[i] / total) * 10000;
    return bp > fromBp && bp <= toBp;
  });
}
