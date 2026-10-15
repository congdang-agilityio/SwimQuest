// Route progress from team points (FR-41, BR-34). Integer math only (NFR-08).
// Route length in points = route km x points per km. Distances are metres.

export type RouteProgressInput = {
  teamPoints: number;
  routeDistanceM: number;
  pointsPerKm: number;
};

export type RouteProgress = {
  /** Basis points, 0..10000, floored and capped at the end of the route. */
  progressBp: number;
  /** Route km reached, truncated to 0.1 km, capped at routeKmTotal. */
  routeKmReached: number;
  /** Whole route length in km (routeDistanceM / 1000). */
  routeKmTotal: number;
  finished: boolean;
};

function assertNonNegativeInt(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

export function routeProgress(input: RouteProgressInput): RouteProgress {
  const { teamPoints, routeDistanceM, pointsPerKm } = input;
  assertNonNegativeInt("teamPoints", teamPoints);
  assertNonNegativeInt("routeDistanceM", routeDistanceM);
  assertNonNegativeInt("pointsPerKm", pointsPerKm);
  if (routeDistanceM === 0 || pointsPerKm === 0) {
    throw new RangeError("routeDistanceM and pointsPerKm must be positive");
  }

  // Route length in points, scaled by 1000 (points x 1000 = metres x pointsPerKm).
  const routeScaled = routeDistanceM * pointsPerKm;
  const pointsScaled = teamPoints * 1000;
  const finished = pointsScaled >= routeScaled;

  const progressBp = finished ? 10000 : Math.floor((pointsScaled * 10000) / routeScaled);
  const reachedM = finished ? routeDistanceM : Math.floor(pointsScaled / pointsPerKm);

  return {
    progressBp,
    routeKmReached: Math.floor(reachedM / 100) / 10,
    routeKmTotal: routeDistanceM / 1000,
    finished,
  };
}

/**
 * Display rule: round half up to one decimal of a percent; drop a ".0".
 * 6800 -> "68%", 6849 -> "68.5%", 10000 -> "100%", 9999 -> "99.9%".
 */
export function formatProgressPct(bp: number): string {
  assertNonNegativeInt("bp", bp);
  const capped = Math.min(bp, 10000);
  // Never show 100% before the route is finished.
  const tenths = capped < 10000 ? Math.min(999, Math.round(capped / 10)) : 1000;
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  return frac === 0 ? `${whole}%` : `${whole}.${frac}%`;
}

/** "68 / 100 route km" (km shown with at most one decimal). */
export function formatRouteKmLabel(progress: RouteProgress): string {
  return `${progress.routeKmReached} / ${progress.routeKmTotal} route km`;
}
