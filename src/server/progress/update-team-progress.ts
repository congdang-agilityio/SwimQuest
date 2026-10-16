import { routeProgress } from "@/lib/scoring/progress";
import type { Tx } from "@/server/checks/run-checks";
import { emitEvent } from "@/server/events/emit";
import { getTeamPoints } from "@/server/scoring/team-points";

/** Why a finished team dropped below 100% (S-47): a revoked swim or a player moved away. */
export type FinishLostReason = "SWIM_REVOKED" | "PLAYER_MOVED";

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
 * transactions that both inserted points before updating the progress.
 * Lock order: a transaction that updates several teams must call this in ascending `teamId`
 * order (plain string comparison), as `runChecks` does; any other order can deadlock with a
 * concurrent upload. Later callers (team moves, revocations) must follow the same order.
 * Points keep counting after the finish; the finish time never moves while the team stays at
 * 100%. A finished team that drops below 100% loses its finish (S-47): `finishedAt` is cleared,
 * `finishLostAt`/`finishLostReason` record when and why (`reason`, default SWIM_REVOKED since
 * any other drop comes from a points reversal), and TEAM_FINISH_LOST is emitted. Reaching 100%
 * again records a new `finishedAt` (used for tie order), clears the loss and emits TEAM_FINISHED.
 * Progress and finish come only from the points ledger, never from a client value (AC 5).
 */
export async function updateTeamProgress(
  tx: Tx,
  tournamentId: string,
  teamId: string,
  now: Date,
  reason: FinishLostReason = "SWIM_REVOKED",
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
  const losesFinish = !finished && team.finishedAt !== null;
  if (progressBp === team.progressBp && !finishes && !losesFinish) return;

  const finish = finishes
    ? { finishedAt: now, finishLostAt: null, finishLostReason: null }
    : losesFinish
      ? { finishedAt: null, finishLostAt: now, finishLostReason: reason }
      : {};
  await tx.team.update({ where: { id: teamId }, data: { progressBp, ...finish } });
  if (progressBp !== team.progressBp) {
    await emitEvent(tx, {
      type: "TEAM_PROGRESS_CHANGED",
      payload: { tournamentId, teamId, fromBp: team.progressBp, toBp: progressBp },
    });
  }
  if (finishes) {
    await emitEvent(tx, { type: "TEAM_FINISHED", payload: { tournamentId, teamId } });
  }
  if (losesFinish) {
    await emitEvent(tx, { type: "TEAM_FINISH_LOST", payload: { tournamentId, teamId } });
  }
}
