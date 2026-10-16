import type { Prisma, Tournament } from "@prisma/client";
import { effectiveStatus } from "@/lib/tournaments/lifecycle";
import { isSettingsGroup, SETTINGS_GROUPS, type SettingsGroup } from "@/lib/validation/settings";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";

type Values = Record<string, unknown>;

export type UpdateSettingsResult =
  | { ok: true; group: string; values: Values }
  | { ok: false; reason: "UNKNOWN_GROUP" | "SEASON_LOCKED" }
  | { ok: false; reason: "INVALID"; errors: Record<string, string> };

/** Only a draft, or a published tournament before its season start, may change locked groups. */
const OPEN_FOR_SEASON_SETTINGS = (now: Date): Prisma.TournamentWhereInput => ({
  OR: [{ status: "DRAFT" }, { status: "PUBLISHED", seasonStartAt: { gt: now } }],
});

function errorsOf(
  issues: { code: string; path: PropertyKey[]; message: string; keys?: string[] }[],
) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    if (issue.code === "unrecognized_keys")
      for (const key of issue.keys ?? []) errors[key] ??= "UNKNOWN_FIELD";
    else errors[String(issue.path[0] ?? "body")] ??= issue.message;
  }
  return errors;
}

const isLocked = (s: SettingsGroup, t: Tournament, now: Date) =>
  s.seasonLocked && !["DRAFT", "PUBLISHED"].includes(effectiveStatus(t, now));

/**
 * Saves one settings group (story S-23 AC 2, AC 5). Organizer only (throws the role errors of
 * `requireOrganizer`). A season-locked group is refused with SEASON_LOCKED once the tournament is
 * ACTIVE or later; the write is conditional on the stored status, season start and the group's
 * write guard, so a concurrent change of them cannot slip through; on a miss the tournament is
 * re-read and checked once more. Returns the stored values (km as metres).
 */
export async function updateSettings(
  userId: string,
  tournamentId: string,
  group: string,
  input: unknown,
  now: Date,
): Promise<UpdateSettingsResult> {
  let tournament = await requireOrganizer(userId, tournamentId);
  if (!isSettingsGroup(group)) return { ok: false, reason: "UNKNOWN_GROUP" };
  const settings: SettingsGroup = SETTINGS_GROUPS[group];
  if (isLocked(settings, tournament, now)) return { ok: false, reason: "SEASON_LOCKED" };
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return { ok: false, reason: "INVALID", errors: { body: "INVALID_BODY" } };

  // A second try re-reads the tournament: a concurrent save may have changed what we checked.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      tournament = await requireOrganizer(userId, tournamentId);
      if (isLocked(settings, tournament, now)) return { ok: false, reason: "SEASON_LOCKED" };
    }
    const parsed = (settings.schemaFor?.(tournament) ?? settings.schema).safeParse(input);
    if (!parsed.success)
      return { ok: false, reason: "INVALID", errors: errorsOf(parsed.error.issues) };
    const where = settings.seasonLocked ? OPEN_FOR_SEASON_SETTINGS(now) : {};
    const guard = settings.writeGuard?.(parsed.data) ?? {};
    const { count } = await db.tournament.updateMany({
      where: { AND: [{ id: tournament.id }, where, guard] },
      data: parsed.data,
    });
    if (count > 0) return { ok: true, group, values: parsed.data };
  }
  return { ok: false, reason: "SEASON_LOCKED" };
}

/** Every settings group with its stored values (schema defaults until saved); null if missing. */
export async function getSettings(tournamentId: string): Promise<Record<string, Values> | null> {
  if (!tournamentId) return null;
  const groups = Object.entries(SETTINGS_GROUPS) as [string, SettingsGroup][];
  const select = Object.fromEntries(groups.flatMap(([, g]) => g.columns.map((c) => [c, true])));
  const row = (await db.tournament.findUnique({
    where: { id: tournamentId },
    select,
  })) as Values | null;
  if (!row) return null;
  return Object.fromEntries(
    groups.map(([name, g]) => [name, Object.fromEntries(g.columns.map((c) => [c, row[c]]))]),
  );
}
