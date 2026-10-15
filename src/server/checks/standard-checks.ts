import type { ReasonCode } from "./reasons";

/** The parsed swim facts the standard checks read. Pool and open water are treated the same. */
export type CheckedSwim = {
  isSwim: boolean;
  startedAt: Date;
  /** Whole metres; null, zero, negative or not a number means "no distance". */
  distanceM: number | null;
  durationS: number;
};

/** One tournament's season and realistic swim limits. */
export type CheckTournament = {
  seasonStartAt: Date;
  seasonEndAt: Date;
  fastestPaceSecPer100m: number;
  slowestPaceSecPer100m: number;
  longestRealisticSwimM: number;
};

export type StandardCheckResult = {
  status: "VERIFIED" | "FLAGGED";
  reasons: ReasonCode[];
};

/**
 * Standard checks of one swim against one tournament (S-12). Every failing check is listed,
 * in a fixed order. Boundaries are inclusive (season start and end, fastest and slowest pace,
 * longest swim). Comparisons are written so that invalid numbers or dates fail the check.
 * Duplicates and organizer rules are checked elsewhere.
 */
export function evaluateSwim(swim: CheckedSwim, tournament: CheckTournament): StandardCheckResult {
  const reasons: ReasonCode[] = [];
  if (swim.isSwim !== true) reasons.push("NOT_A_SWIM");

  const start = swim.startedAt.getTime();
  const inSeason =
    start >= tournament.seasonStartAt.getTime() && start <= tournament.seasonEndAt.getTime();
  if (!inSeason) reasons.push("OUTSIDE_SEASON");

  const distanceM = swim.distanceM;
  if (distanceM === null || !(distanceM > 0)) {
    reasons.push("NO_DISTANCE");
  } else {
    const paceSecPer100m = swim.durationS / (distanceM / 100);
    if (!(paceSecPer100m >= tournament.fastestPaceSecPer100m)) reasons.push("PACE_TOO_FAST");
    else if (!(paceSecPer100m <= tournament.slowestPaceSecPer100m)) reasons.push("PACE_TOO_SLOW");
    if (!(distanceM <= tournament.longestRealisticSwimM)) reasons.push("DISTANCE_TOO_LONG");
  }

  return { status: reasons.length === 0 ? "VERIFIED" : "FLAGGED", reasons };
}
