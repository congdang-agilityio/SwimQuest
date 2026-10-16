import { routeProgress } from "@/lib/scoring/progress";
import type { Tx } from "@/server/checks/run-checks";
import { emitEvent } from "@/server/events/emit";
import { getTeamPoints } from "@/server/scoring/team-points";

type LockedTeam = {
  progressBp: number;
  finishedAt: Date | null;
  routeDistanceM: number;
  pointsPerKm: number;
};

/**
 * Recomputes a team's route progress from its server-side points (FR-41, BR-34), caches it in
 * `Team.progressBp` and records the finish once (S-19, FR-42). Call it inside the transaction of
 * every points change. The team row stays locked until the transaction ends, so concurrent
 * updates run one after the other and only the first one to reach 100% sets `finishedAt` and
 * emits TEAM_FINISHED. The lock is FOR NO KEY UPDATE, not FOR UPDATE: each new points entry
 * holds a FOR KEY SHARE lock on its team (foreign key), and FOR UPDATE would deadlock two
 * transactions that both inserted points before updating the progress. Points keep counting after the finish; the finish time never moves.
 * Progress and finish come only from the points ledger, never from a client value (AC 5).
 */
export async function updateTeamProgress(
  tx: Tx,
  tournamentId: string,
  teamId: string,
  now: Date,
): Promise<void> {
  const [team] = await tx.$queryRaw<LockedTeam[]>`
    SELECT t."progressBp", t."finishedAt", r."routeDistanceM", r."pointsPerKm"
    FROM "Team" t
    JOIN "Tournament" r ON r."id" = t."tournamentId"
    WHERE t."id" = ${teamId} AND t."tournamentId" = ${tournamentId}
    FOR NO KEY UPDATE OF t`;
  if (!team) return;

  const teamPoints = await getTeamPoints(tournamentId, teamId, tx);
  const { progressBp, finished } = routeProgress({
    teamPoints,
    routeDistanceM: team.routeDistanceM,
    pointsPerKm: team.pointsPerKm,
  });
  const finishes = finished && team.finishedAt === null;
  if (progressBp === team.progressBp && !finishes) return;

  await tx.team.update({
    where: { id: teamId },
    data: { progressBp, ...(finishes ? { finishedAt: now } : {}) },
  });
  if (progressBp !== team.progressBp) {
    await emitEvent(tx, {
      type: "TEAM_PROGRESS_CHANGED",
      payload: { tournamentId, teamId, fromBp: team.progressBp, toBp: progressBp },
    });
  }
  if (finishes) {
    await emitEvent(tx, { type: "TEAM_FINISHED", payload: { tournamentId, teamId } });
  }
}
