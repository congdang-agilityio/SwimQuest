import { getRoute } from "@/lib/routes";
import { SWIM_LIMIT_BOUNDS, type SwimLimitField } from "@/lib/swim-limits";
import { boundOf } from "@/lib/validation/settings/realistic-limits";

export type PublishIssueCode =
  | "SEASON_END_NOT_AFTER_START"
  | "REALISTIC_LIMITS_OUT_OF_BOUNDS"
  | "ROUTE_MISSING"
  | "ROUTE_DISTANCE_INVALID"
  | "NO_TEAM";

/** One thing to fix before publishing; `field` names the form field the UI links to. */
export type PublishIssue = { code: PublishIssueCode; field: string };

export type PublishCandidate = {
  seasonStartAt: Date;
  seasonEndAt: Date;
  routeId: string;
  routeDistanceM: number;
  /** Bounds snapshot taken at creation; null or broken uses the starting bounds. */
  swimLimitBounds?: unknown;
} & Record<SwimLimitField, number>;

/** Checked against the tournament's own bounds snapshot (S-64), so later admin changes never reach it. */
const LIMIT_FIELDS = Object.keys(SWIM_LIMIT_BOUNDS) as SwimLimitField[];

/** A route that can be published: known, with exactly one finish (FR-22, BR-01). */
function hasUsableRoute(routeId: string): boolean {
  const route = typeof routeId === "string" && routeId.length > 0 ? getRoute(routeId) : null;
  return route !== null && route.destinations.filter((d) => d.isFinish).length === 1;
}

/**
 * Checks a stored draft before publishing (story S-06 AC 1, FR-22, BR-16) and returns every
 * issue, in form order; an empty list means it can be published.
 */
export function validateForPublish(t: PublishCandidate, teams: readonly unknown[]): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const start = t.seasonStartAt?.getTime?.();
  const end = t.seasonEndAt?.getTime?.();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) {
    issues.push({ code: "SEASON_END_NOT_AFTER_START", field: "seasonEnd" });
  }
  for (const field of LIMIT_FIELDS) {
    const value = t[field];
    const { min, max } = boundOf(t.swimLimitBounds, field);
    if (!Number.isFinite(value) || value < min || value > max) {
      issues.push({ code: "REALISTIC_LIMITS_OUT_OF_BOUNDS", field });
    }
  }
  if (!hasUsableRoute(t.routeId)) issues.push({ code: "ROUTE_MISSING", field: "routeId" });
  if (!Number.isSafeInteger(t.routeDistanceM) || t.routeDistanceM <= 0) {
    issues.push({ code: "ROUTE_DISTANCE_INVALID", field: "routeDistanceKm" });
  }
  if (!Array.isArray(teams) || teams.length === 0) issues.push({ code: "NO_TEAM", field: "teams" });
  return issues;
}
