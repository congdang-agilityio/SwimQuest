// Route progress from team points (FR-41, BR-34): integer math only (NFR-08).
export type RouteProgress = {
  progressBp: number; // basis points 0..10000, floored, capped at the route end
  routeKmReached: number; // truncated to 0.1 km, capped at routeKmTotal
  routeKmTotal: number; // routeDistanceM / 1000
  finished: boolean;
};

const bad = (v: number, min: number) => !Number.isSafeInteger(v) || v < min;

export function routeProgress(i: {
  teamPoints: number;
  routeDistanceM: number;
  pointsPerKm: number;
}): RouteProgress {
  const { teamPoints, routeDistanceM, pointsPerKm } = i;
  if (bad(teamPoints, 0) || bad(routeDistanceM, 1) || bad(pointsPerKm, 1)) {
    throw new RangeError("points must be >= 0 and route values positive integers");
  }
  const total = routeDistanceM * pointsPerKm; // route length in points x 1000
  const done = teamPoints * 1000;
  const finished = done >= total;
  const reachedM = finished ? routeDistanceM : Math.floor(done / pointsPerKm);
  return {
    progressBp: finished ? 10000 : Math.floor((done * 10000) / total),
    routeKmReached: Math.floor(reachedM / 100) / 10,
    routeKmTotal: routeDistanceM / 1000,
    finished,
  };
}

/** Round half up to 0.1%, drop ".0", never "100%" before finished: 6849 -> "68.5%". */
export function formatProgressPct(bp: number): string {
  if (bad(bp, 0)) throw new RangeError("bp must be a non-negative integer");
  const t = bp >= 10000 ? 1000 : Math.min(999, Math.round(bp / 10));
  return t % 10 === 0 ? `${t / 10}%` : `${Math.floor(t / 10)}.${t % 10}%`;
}

export const formatRouteKmLabel = (p: RouteProgress) =>
  `${p.routeKmReached} / ${p.routeKmTotal} route km`;
