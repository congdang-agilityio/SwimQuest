import { z } from "zod";
import { SWIM_LIMIT_BOUNDS, type SwimLimitField } from "@/lib/swim-limits";
import { formatPace, parsePace } from "./extra-rules";

export type RealisticLimitsContext = {
  /** Bounds snapshot taken at creation (S-64); null or a broken field uses the starting bounds. */
  swimLimitBounds: unknown;
  extraSlowestPaceSecPer100m: number | null;
  minSwimDistanceM: number | null;
};

const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

function boundOf(snapshot: unknown, field: SwimLimitField) {
  const b = (snapshot as Record<string, { min?: unknown; max?: unknown }> | null)?.[field];
  return b && isCount(b.min) && isCount(b.max) && b.min <= b.max
    ? { min: b.min, max: b.max }
    : SWIM_LIMIT_BOUNDS[field];
}

/** Km as typed or a number, > 0 with at most 2 decimals, to whole metres; null if malformed. */
function parseKm(value: unknown): number | null {
  const raw = typeof value === "string" && /^\d+(\.\d{1,2})?$/.test(value.trim()) ? +value : value;
  if (typeof raw !== "number" || !(raw > 0) || !Number.isFinite(raw)) return null;
  return Math.abs(raw * 100 - Math.round(raw * 100)) > 1e-6 ? null : Math.round(raw * 1000);
}

const INPUTS = [
  ["fastestPace", "fastestPaceSecPer100m", parsePace, "PACE_INVALID", formatPace],
  ["slowestPace", "slowestPaceSecPer100m", parsePace, "PACE_INVALID", formatPace],
  [
    "longestRealisticSwimKm",
    "longestRealisticSwimM",
    parseKm,
    "DISTANCE_INVALID",
    (m: number) => String(m / 1000),
  ],
] as const;

/**
 * S-93 realistic swim limits (FR-78, FR-85): fastest and slowest pace ("m:ss" per 100 m) and
 * the longest realistic swim (km), each inside the tournament's bounds snapshot. The fastest
 * pace must be faster than the slowest, and an extra slowest pace or minimum distance already
 * set (S-26, BR-25) must stay stricter. A refused bound adds `<field>Range` with the allowed range.
 */
export const realisticLimitsSettingsSchema = (t: RealisticLimitsContext) =>
  z
    .strictObject({
      fastestPace: z.unknown().optional(),
      slowestPace: z.unknown().optional(),
      longestRealisticSwimKm: z.unknown().optional(),
    })
    .transform((v, ctx) => {
      const out: Partial<Record<SwimLimitField, number>> = {};
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: "custom", path: [path], message });
      for (const [input, field, parse, invalid, show] of INPUTS) {
        const value = parse(v[input]);
        const { min, max } = boundOf(t.swimLimitBounds, field);
        if (value === null) issue(input, invalid);
        else if (value < min || value > max) {
          issue(input, "LIMIT_OUT_OF_BOUNDS");
          issue(`${input}Range`, `${show(min)}-${show(max)}`);
        } else out[field] = value;
      }
      const { fastestPaceSecPer100m: fast, slowestPaceSecPer100m: slow } = out;
      const { longestRealisticSwimM: longest } = out;
      if (fast !== undefined && slow !== undefined && fast >= slow)
        issue("fastestPace", "FASTEST_NOT_FASTER_THAN_SLOWEST");
      const extra = t.extraSlowestPaceSecPer100m;
      if (slow !== undefined && extra !== null && extra >= slow) {
        issue("slowestPace", "EXTRA_PACE_NOT_STRICTER");
        // Shows the organizer the extra pace the realistic slowest pace must stay above.
        issue("extraSlowestPace", formatPace(extra));
      }
      const min = t.minSwimDistanceM;
      if (longest !== undefined && min !== null && min >= longest) {
        issue("longestRealisticSwimKm", "EXTRA_DISTANCE_NOT_STRICTER");
        // Shows the extra minimum distance (km) the longest realistic swim must stay above.
        issue("minSwimDistance", String(min / 1000));
      }
      if (ctx.issues.length > 0) return z.NEVER;
      return out as Record<SwimLimitField, number>;
    });
