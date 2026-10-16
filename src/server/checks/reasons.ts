/**
 * Reason codes a swim result can carry (stored in SwimResult.reasons). The UI turns them into
 * plain words in the player's language.
 */
export const REASON_CODES = [
  /** The file is not a swim activity. */
  "NOT_A_SWIM",
  /** The swim has no usable distance. */
  "NO_DISTANCE",
  /** Start time is before the season start or after the season end. */
  "OUTSIDE_SEASON",
  /** Pace per 100 m is faster than the tournament's fastest realistic pace. */
  "PACE_TOO_FAST",
  /** Pace per 100 m is slower than the tournament's slowest realistic pace. */
  "PACE_TOO_SLOW",
  /** Distance is above the tournament's longest realistic swim. */
  "DISTANCE_TOO_LONG",
  /** The same file or a time-overlapping swim of the player was uploaded earlier. */
  "DUPLICATE_OF_EARLIER_SWIM",
  /** The swim's type (pool / open water) is not one the tournament accepts (rule check). */
  "SWIM_TYPE_NOT_ACCEPTED",
  /** Uploaded more than the tournament's N days after the swim date, Vietnam time (rule check). */
  "UPLOADED_AFTER_DEADLINE",
  /** Uploaded at or after the season end time plus the tournament's M days (rule check). */
  "UPLOAD_WINDOW_CLOSED",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export type ReasonParams = Record<string, string | number>;

/** A reason with the values it refers to, e.g. the accepted swim type and the swim's type. */
export type Reason = { code: ReasonCode; params?: ReasonParams };

/**
 * A reason as stored: standard checks store plain codes, rule checks store `{ code, params }`.
 * Readers accept both.
 */
export type StoredReason = string | { code: string; params?: ReasonParams };

/** The code of a stored reason. */
export const reasonCodeOf = (r: StoredReason): string => (typeof r === "string" ? r : r.code);

function readParams(value: unknown): ReasonParams | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter(
    ([, v]) => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)),
  );
  return Object.fromEntries(entries) as ReasonParams;
}

/** Reads SwimResult.reasons: plain codes and `{ code, params? }` objects; drops anything else. */
export function readReasons(json: unknown): StoredReason[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((x): StoredReason[] => {
    if (typeof x === "string") return [x];
    if (typeof x !== "object" || x === null || typeof x.code !== "string") return [];
    const params = readParams((x as { params?: unknown }).params);
    return [params ? { code: x.code, params } : { code: x.code }];
  });
}
