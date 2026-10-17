import {
  effectiveStatus,
  isSeasonConfigLocked,
  SEASON_LOCKED_FIELDS,
} from "@/lib/tournaments/lifecycle";
import { tournamentDraftFieldsSchema } from "@/lib/validation/tournament";
import { requireOrganizerOrAdmin } from "@/server/auth/roles";
import { changedFields } from "@/server/audit/diff";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { db } from "@/server/db";

const detailsSchema = tournamentDraftFieldsSchema
  .pick({ name: true, description: true, seasonStart: true, seasonEnd: true })
  .partial();
const DETAIL_FIELDS = Object.keys(detailsSchema.shape);
/** Input field -> stored column, for the season-locked fields an edit may name. */
const INPUT_COLUMN: Record<string, string> = {
  seasonStart: "seasonStartAt",
  routeId: "routeId",
  routeDistanceKm: "routeDistanceM",
};
const isSeasonLockedInput = (key: string) =>
  (SEASON_LOCKED_FIELDS as readonly string[]).includes(INPUT_COLUMN[key] ?? "");

export type TournamentDetails = {
  id: string;
  name: string;
  description: string;
  seasonStartAt: Date;
  seasonEndAt: Date;
  startChoiceDeadlineAt: Date | null;
};

export type UpdateDetailsResult =
  | { ok: true; tournament: TournamentDetails }
  | { ok: false; reason: "ARCHIVED" | "SEASON_LOCKED" | "SEASON_ENDED" | "CONFLICT" }
  | { ok: false; reason: "INVALID"; errors: Record<string, string> };

const invalid = (errors: Record<string, string>): UpdateDetailsResult => ({
  ok: false,
  reason: "INVALID",
  errors,
});

/**
 * Edits name, description, season start and season end (story S-32 AC 1, 2, 4). Organizer or
 * platform admin only (throws the role errors of `requireOrganizerOrAdmin`). Fields validate like
 * creation. Once the season configuration is locked (active or later) the season start, route and
 * distance are refused with SEASON_LOCKED and the season end must stay after `now`. Once the season
 * has ended (completed) any season end is refused with SEASON_ENDED, so it cannot reopen; an archived
 * tournament refuses every edit. A null start-choice deadline (the default) follows the season
 * start. The write is conditional on the status and season dates read, else CONFLICT.
 */
export async function updateDetails(
  user: { id: string; isPlatformAdmin: boolean } | null,
  tournamentId: string,
  input: unknown,
  now: Date,
): Promise<UpdateDetailsResult> {
  const t = await requireOrganizerOrAdmin(user, tournamentId);
  if (t.status === "ARCHIVED") return { ok: false, reason: "ARCHIVED" };
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return invalid({ body: "INVALID_BODY" });

  const keys = Object.keys(input);
  const locked = isSeasonConfigLocked(t, now);
  if (locked && keys.some(isSeasonLockedInput)) return { ok: false, reason: "SEASON_LOCKED" };
  if (keys.includes("seasonEnd") && effectiveStatus(t, now) === "COMPLETED")
    return { ok: false, reason: "SEASON_ENDED" };
  const unknown = keys.filter((key) => !DETAIL_FIELDS.includes(key));
  if (unknown.length > 0)
    return invalid(Object.fromEntries(unknown.map((key) => [key, "UNKNOWN_FIELD"])));
  if (keys.length === 0) return invalid({ body: "NO_CHANGE" });

  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return invalid(errors);
  }
  const { name, description, seasonStart, seasonEnd } = parsed.data;
  const seasonStartAt = seasonStart ?? t.seasonStartAt;
  const seasonEndAt = seasonEnd ?? t.seasonEndAt;
  if (seasonEndAt.getTime() <= seasonStartAt.getTime())
    return invalid({ seasonEnd: "SEASON_END_NOT_AFTER_START" });
  if (locked && seasonEnd && seasonEnd.getTime() <= now.getTime())
    return invalid({ seasonEnd: "SEASON_END_NOT_AFTER_NOW" });

  const data = { name, description, seasonStartAt: seasonStart, seasonEndAt: seasonEnd };
  const changes = changedFields(t, data);
  const audited = t.status !== "DRAFT" && Object.keys(changes.after).length > 0;
  const count = await db.$transaction(async (tx) => {
    const { count } = await tx.tournament.updateMany({
      where: {
        id: t.id,
        status: t.status,
        seasonStartAt: t.seasonStartAt,
        seasonEndAt: t.seasonEndAt,
      },
      data,
    });
    if (count > 0 && audited)
      await recordAudit(tx, {
        actor: { type: "USER", userId: user?.id ?? "" },
        action: AUDIT_ACTIONS.TOURNAMENT_UPDATED,
        entityType: "Tournament",
        entityId: t.id,
        tournamentId: t.id,
        before: changes.before,
        after: changes.after,
      });
    return count;
  });
  if (count === 0) return { ok: false, reason: "CONFLICT" };
  const { id, startChoiceDeadlineAt } = t;
  return {
    ok: true,
    tournament: {
      id,
      name: name ?? t.name,
      description: description ?? t.description,
      seasonStartAt,
      seasonEndAt,
      startChoiceDeadlineAt,
    },
  };
}
