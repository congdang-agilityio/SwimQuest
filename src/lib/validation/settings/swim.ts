import { z } from "zod";

/** Upper bound that keeps metres far inside a 32-bit integer. */
export const MAX_SETTING_KM = 10_000;

/** Kilometres as typed (string) or a number: > 0, at most 2 decimals; returns whole metres. */
const km = z.unknown().transform((value, ctx) => {
  const raw = typeof value === "string" ? value.trim() : value;
  const n = typeof raw === "string" && /^[+-]?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  let error: string | null = null;
  if (raw === undefined || raw === null || raw === "") error = "DISTANCE_REQUIRED";
  else if (typeof n !== "number" || !Number.isFinite(n)) error = "DISTANCE_INVALID";
  else if (n <= 0) error = "DISTANCE_NOT_POSITIVE";
  // Whole hundredths of a km, at least one: a tiny positive value must not round to 0 m.
  else if (Math.round(n * 100) < 1 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6)
    error = "DISTANCE_TOO_PRECISE";
  else if (n > MAX_SETTING_KM) error = "DISTANCE_TOO_LARGE";
  if (error === null) return Math.round((n as number) * 1000);
  ctx.addIssue({ code: "custom", message: error });
  return z.NEVER;
});

/** S-23 swim settings (FR-78, FR-24): km in the input, metres in the output (stored columns). */
export const swimSettingsSchema = z
  .strictObject({
    longestSwimCountedKm: km,
    dailyLimitKm: km,
    swimTypeAllowed: z.enum(["ANY", "POOL_ONLY", "OPEN_WATER_ONLY"], {
      error: "SWIM_TYPE_INVALID",
    }),
  })
  .transform((v) => ({
    longestSwimCountedM: v.longestSwimCountedKm,
    dailyLimitM: v.dailyLimitKm,
    swimTypeAllowed: v.swimTypeAllowed,
  }));
