import { z } from "zod";
import { EMBLEM_KEYS } from "@/lib/emblems";

/**
 * Team rules (FR-31, story S-05), shared by the team form and the server. Every issue message is
 * one of TEAM_ERROR_CODES; the UI maps each to a vi/en message. A one-person team has limit 1.
 */
export const MAX_MEMBER_LIMIT = 2_147_483_647; // the database column is a 32-bit integer

// prettier-ignore
export const TEAM_ERROR_CODES = [
  "NAME_REQUIRED", "NAME_TOO_LONG", "EMBLEM_INVALID", "DESCRIPTION_TOO_LONG", "LIMIT_INVALID",
] as const;
export type TeamErrorCode = (typeof TEAM_ERROR_CODES)[number];

const code = (error: TeamErrorCode) => ({ error, abort: true });

const teamSchema = z.object({
  name: z
    .string(code("NAME_REQUIRED"))
    .trim()
    .min(1, code("NAME_REQUIRED"))
    .max(40, code("NAME_TOO_LONG")),
  emblemKey: z.enum(EMBLEM_KEYS, code("EMBLEM_INVALID")),
  description: z
    .string(code("DESCRIPTION_TOO_LONG"))
    .trim()
    .max(200, code("DESCRIPTION_TOO_LONG"))
    .nullish()
    .transform((d) => d || null),
  memberLimit: z
    .number(code("LIMIT_INVALID"))
    .int(code("LIMIT_INVALID"))
    .min(1, code("LIMIT_INVALID"))
    .max(MAX_MEMBER_LIMIT, code("LIMIT_INVALID")),
});

export type TeamInput = z.output<typeof teamSchema>;
export type TeamField = keyof typeof teamSchema.shape;
export type TeamErrors = Partial<Record<TeamField, TeamErrorCode>>;

/** Validates a team's fields and returns the first error code of each invalid field. */
export function parseTeamInput(
  input: unknown,
): { ok: true; data: TeamInput } | { ok: false; errors: TeamErrors } {
  const isPlainObject = typeof input === "object" && input !== null && !Array.isArray(input);
  const result = teamSchema.safeParse(isPlainObject ? input : {});
  if (result.success) return { ok: true, data: result.data };
  const errors: TeamErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as TeamField;
    if (field in teamSchema.shape) errors[field] ??= issue.message as TeamErrorCode;
  }
  return { ok: false, errors };
}
