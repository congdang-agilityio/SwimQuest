import type { SwimResult } from "@prisma/client";
import type { Tx } from "@/server/checks/run-checks";
import { updateTeamProgress } from "@/server/progress/update-team-progress";
import { awardBonuses } from "./award-bonuses";
import { awardDistancePoints } from "./award-distance-points";

/**
 * The single hook for a newly VERIFIED result, run inside the caller's transaction: award the
 * distance points (S-13) and the first-swim and long-swim bonuses (S-20), then refresh the
 * team's progress and finish (S-19). Later scoring (multiplier, badges, XP) plugs in here before
 * the progress update.
 */
export async function onVerified(tx: Tx, result: SwimResult, now: Date = new Date()) {
  if (result.status !== "VERIFIED") return;
  await awardDistancePoints(tx, result);
  await awardBonuses(tx, result);
  await updateTeamProgress(tx, result.tournamentId, result.teamId, now);
}
