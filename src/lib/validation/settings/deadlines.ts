import { z } from "zod";
import { vnLocalToUtc } from "@/lib/time/vn";

export const MAX_DEADLINE_DAYS = 60;
export const DEFAULT_SUBMISSION_DAYS = 7;
export const DEFAULT_LATE_UPLOAD_DAYS = 3;

/** Whole days 0..60 as typed (string) or a number; missing or empty = the default. */
function parseDays(value: unknown, fallback: number): number | null {
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = typeof raw === "string" && /^[+-]?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  const ok = typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_DEADLINE_DAYS;
  return ok ? n : null;
}

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim());

/**
 * S-26 deadline settings: N days to upload after the swim date, M days after the season end,
 * and an optional start-choice deadline (Vietnam date and time) not after the season start.
 * Empty deadline = null = "at the season start". Pass `seasonStartAt` to enforce the bound.
 */
export const deadlinesSettingsSchema = (seasonStartAt?: Date) =>
  z
    .strictObject({
      submissionDays: z.unknown().optional(),
      lateUploadDays: z.unknown().optional(),
      startChoiceDeadlineDate: z.unknown().optional(),
      startChoiceDeadlineTime: z.unknown().optional(),
    })
    .transform((v, ctx) => {
      const { startChoiceDeadlineDate: date, startChoiceDeadlineTime: time } = v;
      const submissionDays = parseDays(v.submissionDays, DEFAULT_SUBMISSION_DAYS);
      const lateUploadDays = parseDays(v.lateUploadDays, DEFAULT_LATE_UPLOAD_DAYS);
      let bad = false;
      for (const [key, value] of [
        ["submissionDays", submissionDays],
        ["lateUploadDays", lateUploadDays],
      ] as const)
        if (value === null) {
          ctx.addIssue({ code: "custom", path: [key], message: "DAYS_INVALID" });
          bad = true;
        }
      if (bad) return z.NEVER;
      let startChoiceDeadlineAt: Date | null = null;
      if (!(blank(date) && blank(time))) {
        try {
          if (typeof date !== "string" || typeof time !== "string") throw new Error("type");
          startChoiceDeadlineAt = vnLocalToUtc(date.trim(), time.trim());
        } catch {
          ctx.addIssue({
            code: "custom",
            path: ["startChoiceDeadlineDate"],
            message: "DEADLINE_INVALID",
          });
          return z.NEVER;
        }
        if (seasonStartAt && startChoiceDeadlineAt.getTime() > seasonStartAt.getTime()) {
          ctx.addIssue({
            code: "custom",
            path: ["startChoiceDeadlineDate"],
            message: "DEADLINE_AFTER_SEASON_START",
          });
          return z.NEVER;
        }
      }
      return {
        submissionDays: submissionDays as number,
        lateUploadDays: lateUploadDays as number,
        startChoiceDeadlineAt,
      };
    });
