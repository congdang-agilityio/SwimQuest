import { vnWeekRange, vnWeekStart } from "@/lib/time/vn";
import { getRoute, startDestinations } from "@/lib/routes";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { findActiveSwimmers } from "@/server/organizer/participation";

export type FairnessGroup = {
  /** Start slug or "none"; team size; or the band "0", "1-2", "3-5", "6+". */
  key: string;
  teams: number;
  /** Average of `Team.progressBp` in basis points (0 for an empty group). */
  averageProgressBp: number;
  /** Teams with `finishedAt` over teams, whole percent (0 for an empty group). */
  finishRatePct: number;
};

export type Fairness = {
  tournamentId: string;
  /** Every Route 01 start in route order, then "none" for teams without a start. */
  byStart: FairnessGroup[];
  /** Active members count of the team, ascending; only sizes that occur. */
  byTeamSize: FairnessGroup[];
  /** Active members with a qualifying swim this Vietnam week: 0, 1-2, 3-5, 6+. */
  byActiveMembers: FairnessGroup[];
};

export const ACTIVE_BANDS = ["0", "1-2", "3-5", "6+"] as const;
export const bandOf = (n: number): (typeof ACTIVE_BANDS)[number] =>
  n === 0 ? "0" : n <= 2 ? "1-2" : n <= 5 ? "3-5" : "6+";

type Row = { progressBp: number; finished: boolean };

function group(key: string, rows: Row[]): FairnessGroup {
  const n = rows.length;
  return {
    key,
    teams: n,
    averageProgressBp: n === 0 ? 0 : Math.round(rows.reduce((a, r) => a + r.progressBp, 0) / n),
    finishRatePct: n === 0 ? 0 : Math.round((rows.filter((r) => r.finished).length * 100) / n),
  };
}

/**
 * Progress and finish rate grouped by start, team size and weekly activity (story S-80, AC 4).
 * Aggregates only: no player data. Organizer only.
 */
export async function getFairness(
  organizerId: string,
  tournamentId: string,
  now: Date = new Date(),
): Promise<Fairness> {
  await requireOrganizer(organizerId, tournamentId);
  const { start, end } = vnWeekRange(vnWeekStart(now));
  const [tournament, teams, active] = await Promise.all([
    db.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { routeId: true } }),
    db.team.findMany({
      where: { tournamentId },
      select: {
        id: true,
        startDestination: true,
        progressBp: true,
        finishedAt: true,
        members: { where: { status: "ACTIVE" }, select: { userId: true } },
      },
    }),
    findActiveSwimmers(tournamentId, start, end),
  ]);
  const swimmers = new Set(active.map((r) => `${r.teamId}:${r.userId}`));
  const route = getRoute(tournament.routeId);
  const slugs = route ? startDestinations(route).map((d) => d.slug) : [];

  const rows = teams.map((t) => ({
    progressBp: t.progressBp,
    finished: t.finishedAt !== null,
    start:
      t.startDestination !== null && slugs.includes(t.startDestination)
        ? t.startDestination
        : "none",
    size: t.members.length,
    band: bandOf(t.members.filter((m) => swimmers.has(`${t.id}:${m.userId}`)).length),
  }));
  const sizes = [...new Set(rows.map((r) => r.size))].sort((a, b) => a - b);
  return {
    tournamentId,
    byStart: [...slugs, "none"].map((s) =>
      group(
        s,
        rows.filter((r) => r.start === s),
      ),
    ),
    byTeamSize: sizes.map((s) =>
      group(
        String(s),
        rows.filter((r) => r.size === s),
      ),
    ),
    byActiveMembers: ACTIVE_BANDS.map((b) =>
      group(
        b,
        rows.filter((r) => r.band === b),
      ),
    ),
  };
}
