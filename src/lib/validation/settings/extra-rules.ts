import { z } from "zod";

export type RealisticLimits = { slowestPaceSecPer100m: number; longestRealisticSwimM: number };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim());

export const formatPace = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** "m:ss" or "mm:ss" (or whole seconds as a number) to seconds per 100 m; null if malformed. */
function parsePace(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  const m = typeof value === "string" ? /^(\d{1,3}):([0-5]\d)$/.exec(value.trim()) : null;
  const sec = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  return sec > 0 ? sec : null;
}

/**
 * S-26 extra swim rules (FR-72): an optional minimum distance per swim (metres) and an optional
 * slowest allowed pace (mm:ss per 100 m). Empty = off (null). The pace must be faster than the
 * tournament's realistic slowest pace and the distance below its longest realistic swim.
 */
export const extraRulesSettingsSchema = (limits: RealisticLimits) =>
  z
    .strictObject({
      minSwimDistanceM: z.unknown().optional(),
      extraSlowestPace: z.unknown().optional(),
    })
    .transform((v, ctx) => {
      let bad = false;
      const issue = (path: string, message: string) => {
        bad = true;
        ctx.addIssue({ code: "custom", path: [path], message });
      };
      let minSwimDistanceM: number | null = null;
      let pace: number | null = null;
      if (!blank(v.minSwimDistanceM)) {
        const raw = v.minSwimDistanceM;
        const n = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : raw;
        if (typeof n !== "number" || !Number.isInteger(n))
          issue("minSwimDistanceM", "DISTANCE_INVALID");
        else if (n <= 0) issue("minSwimDistanceM", "DISTANCE_NOT_POSITIVE");
        else if (n >= limits.longestRealisticSwimM)
          issue("minSwimDistanceM", "EXTRA_DISTANCE_TOO_LARGE");
        else minSwimDistanceM = n;
      }
      if (!blank(v.extraSlowestPace)) {
        pace = parsePace(v.extraSlowestPace);
        if (pace === null) issue("extraSlowestPace", "PACE_INVALID");
        else if (pace >= limits.slowestPaceSecPer100m) {
          issue("extraSlowestPace", "EXTRA_PACE_NOT_STRICTER");
          // Shows the organizer the realistic value the extra pace must beat.
          issue("realisticSlowestPace", formatPace(limits.slowestPaceSecPer100m));
        }
      }
      if (bad) return z.NEVER;
      return { minSwimDistanceM, extraSlowestPaceSecPer100m: pace };
    });
