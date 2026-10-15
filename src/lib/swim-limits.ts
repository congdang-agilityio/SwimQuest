/**
 * Platform defaults copied into every new tournament's realistic swim limits (FR-78 item 9,
 * FR-85: 1:05 and 5:00 per 100 m, 30 km). Constants until the admin edits them (S-64); the
 * organizer changes a tournament's copy inside the sanity bounds in S-93.
 */
export const DEFAULT_SWIM_LIMITS = Object.freeze({
  fastestPaceSecPer100m: 65,
  slowestPaceSecPer100m: 300,
  longestRealisticSwimM: 30_000,
});
