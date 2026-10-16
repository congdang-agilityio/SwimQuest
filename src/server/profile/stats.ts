import { db } from "@/server/db";
import { routeProgress, type RouteProgress } from "@/lib/scoring/progress";
import { vnDayKey } from "@/lib/time/vn";
import { getTeamsPoints } from "@/server/scoring/team-points";

/** A swim must be at least this long (metres) to make its Vietnam day an active day. */
export const ACTIVE_DAY_MIN_M = 500;

export type PlayerStats = {
  verifiedSwims: number;
  verifiedDistanceM: number;
  activeDays: number;
  tournamentsJoined: number;
  teams: number;
  /** Progress of each team the player is on now (ACTIVE memberships). */
  currentProgress: { tournamentId: string; teamId: string; progress: RouteProgress }[];
  badges: number;
};

/**
 * Verified stats of a player across every tournament (FR-14). Computed on read from verified
 * data only and never stored: a swim counts once when at least one of its results is VERIFIED.
 */
export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  if (typeof userId !== "string" || !userId) throw new TypeError("userId is required");

  const [swims, memberships, badges] = await Promise.all([
    db.swim.findMany({
      where: { userId, results: { some: { status: "VERIFIED" } } },
      select: { distanceM: true, startedAt: true },
    }),
    db.teamMember.findMany({
      where: { userId },
      select: {
        status: true,
        teamId: true,
        tournamentId: true,
        tournament: { select: { routeDistanceM: true, pointsPerKm: true } },
      },
    }),
    db.badge.count({ where: { userId, removedAt: null } }),
  ]);

  const days = new Set<string>();
  let verifiedDistanceM = 0;
  for (const s of swims) {
    verifiedDistanceM += s.distanceM;
    if (s.distanceM >= ACTIVE_DAY_MIN_M) days.add(vnDayKey(s.startedAt));
  }

  const current = memberships.filter((m) => m.status === "ACTIVE");
  const pointsByTournament = new Map(
    await Promise.all(
      [...new Set(current.map((m) => m.tournamentId))].map(
        async (id) => [id, await getTeamsPoints(id)] as const,
      ),
    ),
  );
  const currentProgress = current.map((m) => ({
    tournamentId: m.tournamentId,
    teamId: m.teamId,
    progress: routeProgress({
      teamPoints: pointsByTournament.get(m.tournamentId)?.get(m.teamId) ?? 0,
      routeDistanceM: m.tournament.routeDistanceM,
      pointsPerKm: m.tournament.pointsPerKm,
    }),
  }));

  return {
    verifiedSwims: swims.length,
    verifiedDistanceM,
    activeDays: days.size,
    tournamentsJoined: new Set(memberships.map((m) => m.tournamentId)).size,
    teams: new Set(memberships.map((m) => m.teamId)).size,
    currentProgress,
    badges,
  };
}
