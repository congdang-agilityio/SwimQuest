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

/** Platform defaults and sanity bounds, as the platform admin edits them (S-64). */
export type SwimLimitConfig = {
  defaults: Record<SwimLimitField, number>;
  bounds: Record<SwimLimitField, { min: number; max: number }>;
};
/** Field errors by path, e.g. `{ "bounds.longestRealisticSwimM": "MIN_ABOVE_MAX" }`. */
export type LimitConfigErrors = Record<string, string>;
/** The config used until a platform admin saves one. */
export const STARTING_SWIM_LIMIT_CONFIG: SwimLimitConfig = Object.freeze({
  defaults: DEFAULT_SWIM_LIMITS,
  bounds: SWIM_LIMIT_BOUNDS,
});

const FIELDS = Object.keys(DEFAULT_SWIM_LIMITS) as SwimLimitField[];
const at = (v: unknown, key: string): unknown =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)[key]
    : undefined;
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

/**
 * Checks a config (S-64 AC 4): positive whole numbers (s per 100 m or m), each min <= max, each
 * default inside its bounds, and the default fastest pace faster than the default slowest.
 */
export function validateLimitConfig(
  input: unknown,
): { ok: true; config: SwimLimitConfig } | { ok: false; errors: LimitConfigErrors } {
  const errors: LimitConfigErrors = {};
  const config = { defaults: {}, bounds: {} } as SwimLimitConfig;
  for (const f of FIELDS) {
    const value = at(at(input, "defaults"), f);
    const bound = at(at(input, "bounds"), f);
    const [min, max] = [at(bound, "min"), at(bound, "max")];
    if (!isCount(value)) errors[`defaults.${f}`] = "INVALID_NUMBER";
    if (!isCount(min)) errors[`bounds.${f}.min`] = "INVALID_NUMBER";
    if (!isCount(max)) errors[`bounds.${f}.max`] = "INVALID_NUMBER";
    if (!isCount(value) || !isCount(min) || !isCount(max)) continue;
    if (min > max) errors[`bounds.${f}`] = "MIN_ABOVE_MAX";
    else if (value < min || value > max) errors[`defaults.${f}`] = "OUT_OF_BOUNDS";
    config.defaults[f] = value;
    config.bounds[f] = { min, max };
  }
  const { fastestPaceSecPer100m: fast, slowestPaceSecPer100m: slow } = config.defaults;
  if (fast !== undefined && slow !== undefined && fast >= slow)
    errors["defaults.fastestPaceSecPer100m"] ??= "NOT_FASTER_THAN_SLOWEST";
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, config };
}
