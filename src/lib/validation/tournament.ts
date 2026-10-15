import { z } from "zod";
import { getRoute } from "@/lib/routes";
import { vnLocalToUtc } from "@/lib/time/vn";

/**
 * Tournament draft rules (FR-21, FR-22, FR-40, Q-58), shared by the create form and the server.
 * Every issue message is one of TOURNAMENT_DRAFT_ERROR_CODES; the UI maps each to a vi/en message.
 */
export const MAX_ROUTE_DISTANCE_KM = 10_000; // keeps metres far inside a 32-bit integer

// prettier-ignore
export const TOURNAMENT_DRAFT_ERROR_CODES = [
  "NAME_REQUIRED", "NAME_TOO_LONG", "DESCRIPTION_REQUIRED", "DESCRIPTION_TOO_LONG",
  "SEASON_START_INVALID", "SEASON_END_INVALID", "SEASON_END_NOT_AFTER_START", "ROUTE_UNKNOWN",
  "ROUTE_DISTANCE_REQUIRED", "ROUTE_DISTANCE_INVALID", "ROUTE_DISTANCE_NOT_POSITIVE",
  "ROUTE_DISTANCE_TOO_PRECISE", "ROUTE_DISTANCE_TOO_LARGE",
] as const;
export type TournamentDraftErrorCode = (typeof TOURNAMENT_DRAFT_ERROR_CODES)[number];

const code = (error: TournamentDraftErrorCode) => ({ error, abort: true });
const text = (max: number, required: TournamentDraftErrorCode, tooLong: TournamentDraftErrorCode) =>
  z.string(code(required)).trim().min(1, code(required)).max(max, code(tooLong));

/** A Vietnam local date (YYYY-MM-DD) and time (HH:mm), converted to a UTC instant. */
const vnInstant = (invalid: TournamentDraftErrorCode) =>
  z
    .object({ date: z.string(code(invalid)), time: z.string(code(invalid)) }, code(invalid))
    .transform((v, ctx) => {
      try {
        return vnLocalToUtc(v.date, v.time);
      } catch {
        ctx.addIssue({ code: "custom", message: invalid });
        return z.NEVER;
      }
    });

/** Kilometres as typed (string) or a number: positive, at most 2 decimals; returns metres. */
const routeDistance = z.unknown().transform((value, ctx) => {
  const raw = typeof value === "string" ? value.trim() : value;
  const km = typeof raw === "string" && /^[+-]?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  let error: TournamentDraftErrorCode | null = null;
  if (raw === undefined || raw === null || raw === "") error = "ROUTE_DISTANCE_REQUIRED";
  else if (typeof km !== "number" || !Number.isFinite(km)) error = "ROUTE_DISTANCE_INVALID";
  else if (km <= 0) error = "ROUTE_DISTANCE_NOT_POSITIVE";
  else if (Math.abs(km * 100 - Math.round(km * 100)) > 1e-6) error = "ROUTE_DISTANCE_TOO_PRECISE";
  else if (km > MAX_ROUTE_DISTANCE_KM) error = "ROUTE_DISTANCE_TOO_LARGE";
  if (error === null) return Math.round((km as number) * 1000);
  ctx.addIssue({ code: "custom", message: error });
  return z.NEVER;
});

const fieldsSchema = z.object({
  name: text(80, "NAME_REQUIRED", "NAME_TOO_LONG"),
  description: text(2000, "DESCRIPTION_REQUIRED", "DESCRIPTION_TOO_LONG"),
  seasonStart: vnInstant("SEASON_START_INVALID"),
  seasonEnd: vnInstant("SEASON_END_INVALID"),
  routeId: z
    .string(code("ROUTE_UNKNOWN"))
    .refine((id) => getRoute(id) !== null, code("ROUTE_UNKNOWN")),
  routeDistanceKm: routeDistance,
});

export const tournamentDraftSchema = fieldsSchema
  .refine((v) => v.seasonEnd.getTime() > v.seasonStart.getTime(), {
    message: "SEASON_END_NOT_AFTER_START" satisfies TournamentDraftErrorCode,
    path: ["seasonEnd"],
  })
  .transform(({ seasonStart, seasonEnd, routeDistanceKm, ...rest }) => ({
    ...rest,
    seasonStartAt: seasonStart,
    seasonEndAt: seasonEnd,
    routeDistanceM: routeDistanceKm,
  }));

export type TournamentDraft = z.output<typeof tournamentDraftSchema>;
export type TournamentDraftField = keyof typeof fieldsSchema.shape;
export type TournamentDraftErrors = Partial<Record<TournamentDraftField, TournamentDraftErrorCode>>;

/** Validates a tournament draft and returns the first error code of each invalid field. */
export function parseTournamentDraft(
  input: unknown,
): { ok: true; data: TournamentDraft } | { ok: false; errors: TournamentDraftErrors } {
  const isPlainObject = typeof input === "object" && input !== null && !Array.isArray(input);
  const result = tournamentDraftSchema.safeParse(isPlainObject ? input : {});
  if (result.success) return { ok: true, data: result.data };
  const errors: TournamentDraftErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as TournamentDraftField;
    if (field in fieldsSchema.shape) errors[field] ??= issue.message as TournamentDraftErrorCode;
  }
  return { ok: false, errors };
}
