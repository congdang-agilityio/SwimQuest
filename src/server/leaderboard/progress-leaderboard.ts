import { db } from "@/server/db";
import { routeProgress } from "@/lib/scoring/progress";

export type ProgressLeaderboardRow = {
  teamId: string;
  name: string;
  emblemKey: string;
  progressBp: number;
  routeKmReached: number;
  /** When the team last got to the points that give its current progress; null without points. */
  reachedAt: Date | null;
  isMyTeam: boolean;
};

export class LeaderboardError extends Error {
  constructor(readonly code: "FORBIDDEN") {
    super(code);
    this.name = "LeaderboardError";
  }
}

type Entry = { userId: string; points: number; createdAt: Date };

/**
 * Fewest team points that give `progressBp` (integer math, mirrors `routeProgress`). At 100%
 * this is the route length in points. Never below 1, so "reached" needs actual points.
 */
function thresholdPoints(progressBp: number, routeDistanceM: number, pointsPerKm: number) {
  const totalX1000 = routeDistanceM * pointsPerKm; // route length in points x 1000
  const pts =
    progressBp >= 10000
      ? Math.ceil(totalX1000 / 1000)
      : Math.ceil((progressBp * totalX1000) / 10_000_000);
  return Math.max(1, pts);
}

/**
 * Time the cumulative points (entries in time order) last crossed from below `threshold` to at
 * or above it, so a progress lost through a reversal and regained counts from the new time.
 */
function reachedAtFor(entries: Entry[], threshold: number): Date | null {
  let cumulative = 0;
  let reachedAt: Date | null = null;
  for (const e of entries) {
    const before = cumulative;
    cumulative += e.points;
    if (cumulative < threshold) reachedAt = null;
    else if (before < threshold) reachedAt = e.createdAt;
  }
  return reachedAt;
}

/**
 * Teams of a tournament ranked by route progress (S-15 / FR-50): progress desc, then who
 * reached that progress first, then team name. Points follow the member: entries of each
 * team's current ACTIVE members count, as in `getTeamsPoints`. Only the tournament's active
 * members and its organizer may read it; anyone else (or an unknown id) gets FORBIDDEN.
 */
export async function getProgressLeaderboard(
  viewerId: string,
  tournamentId: string,
): Promise<ProgressLeaderboardRow[]> {
  if (
    typeof viewerId !== "string" ||
    !viewerId ||
    typeof tournamentId !== "string" ||
    !tournamentId
  ) {
    throw new LeaderboardError("FORBIDDEN");
  }
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true, routeDistanceM: true, pointsPerKm: true },
  });
  if (!tournament) throw new LeaderboardError("FORBIDDEN");

  const teams = await db.team.findMany({
    where: { tournamentId },
    select: {
      id: true,
      name: true,
      emblemKey: true,
      members: { where: { status: "ACTIVE" }, select: { userId: true } },
    },
  });
  const teamOfUser = new Map<string, string>();
  for (const team of teams) for (const m of team.members) teamOfUser.set(m.userId, team.id);

  const viewerTeamId = teamOfUser.get(viewerId) ?? null;
  if (!viewerTeamId && tournament.organizerId !== viewerId) {
    throw new LeaderboardError("FORBIDDEN");
  }

  const entries = await db.pointsEntry.findMany({
    where: { tournamentId, userId: { in: [...teamOfUser.keys()] } },
    select: { userId: true, points: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const entriesByTeam = new Map<string, Entry[]>(teams.map((t) => [t.id, []]));
  for (const e of entries) entriesByTeam.get(teamOfUser.get(e.userId)!)!.push(e);

  const { routeDistanceM, pointsPerKm } = tournament;
  const rows = teams.map((team): ProgressLeaderboardRow => {
    const teamEntries = entriesByTeam.get(team.id)!;
    const points = Math.max(
      0,
      teamEntries.reduce((sum, e) => sum + e.points, 0),
    );
    const progress = routeProgress({ teamPoints: points, routeDistanceM, pointsPerKm });
    const reachedAt =
      points > 0
        ? reachedAtFor(
            teamEntries,
            thresholdPoints(progress.progressBp, routeDistanceM, pointsPerKm),
          )
        : null;
    return {
      teamId: team.id,
      name: team.name,
      emblemKey: team.emblemKey,
      progressBp: progress.progressBp,
      routeKmReached: progress.routeKmReached,
      reachedAt,
      isMyTeam: team.id === viewerTeamId,
    };
  });

  const time = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY);
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return rows.sort(
    (a, b) =>
      b.progressBp - a.progressBp ||
      time(a.reachedAt) - time(b.reachedAt) ||
      cmp(a.name, b.name) ||
      cmp(a.teamId, b.teamId),
  );
}
