export type MapPoint = { x: number; y: number };

/**
 * Point at `fraction` (0..1, clamped) of the path's length. Points are percent of the map box;
 * `aspect` (width / height, 18/7 for the Route 01 map) makes lengths true on screen, not in percent.
 */
export function pointAlongPath(path: readonly MapPoint[], fraction: number, aspect = 1): MapPoint {
  if (path.length === 0) throw new RangeError("path needs at least one point");
  const last = path[path.length - 1];
  const f = Number.isNaN(fraction) ? 0 : Math.min(1, Math.max(0, fraction));
  const lengths = path
    .slice(1)
    .map((p, i) => Math.hypot((p.x - path[i].x) * aspect, p.y - path[i].y));
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total === 0 || f >= 1) return f >= 1 ? { ...last } : { ...path[0] };
  let remaining = f * total;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] === 0 ? 0 : remaining / lengths[i];
      const a = path[i];
      const b = path[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= lengths[i];
  }
  return { ...last };
}
