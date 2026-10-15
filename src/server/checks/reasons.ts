/**
 * Reason codes a swim result can carry (stored in SwimResult.reasons). Codes only: the UI
 * turns them into plain words in the player's language.
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
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];
