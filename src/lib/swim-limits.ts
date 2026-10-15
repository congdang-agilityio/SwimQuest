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

export type SwimLimitField = keyof typeof DEFAULT_SWIM_LIMITS;

/**
 * Platform-wide sanity bounds (inclusive) a tournament's realistic swim limits must stay inside
 * to be published (FR-22, FR-85). The requirements give no starting values (A-29): these are
 * the stand-in values (fastest pace 0:45-2:00, slowest pace 3:00-10:00 per 100 m, longest
 * realistic swim 5-60 km) until the admin sets them (S-64).
 */
export const SWIM_LIMIT_BOUNDS: Readonly<Record<SwimLimitField, { min: number; max: number }>> =
  Object.freeze({
    fastestPaceSecPer100m: { min: 45, max: 120 },
    slowestPaceSecPer100m: { min: 180, max: 600 },
    longestRealisticSwimM: { min: 5_000, max: 60_000 },
  });
