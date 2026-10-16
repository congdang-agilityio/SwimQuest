import type { SwimResult } from "@prisma/client";
import { checkPersonalBadgesOnVerified } from "@/server/badges/personal-rules";
import type { Tx } from "@/server/checks/run-checks";
import { updateTeamProgress } from "@/server/progress/update-team-progress";
import { awardBonuses } from "./award-bonuses";
import { awardDistancePoints } from "./award-distance-points";
import { recalculateSettledWeek } from "./settle-week";

/**
 * The single hook for a newly VERIFIED result, run inside the caller's transaction: award the
 * distance points (S-13), the first-swim and long-swim bonuses (S-20) and the personal badges
 * (S-48, no points), then refresh the team's progress and finish (S-19). A result of an already
 * settled week recalculates that week's multiplier (S-21); every team whose points changed is
 * refreshed in ascending order. Later scoring (XP) plugs in here before the progress update.
 */
export async function onVerified(tx: Tx, result: SwimResult, now: Date = new Date()) {
  if (result.status !== "VERIFIED") return;
  await awardDistancePoints(tx, result);
  await awardBonuses(tx, result);
  await checkPersonalBadgesOnVerified(tx, result);
  const teams = await recalculateSettledWeek(tx, result, now);
  for (const teamId of [...new Set([result.teamId, ...teams])].sort()) {
    await updateTeamProgress(tx, result.tournamentId, teamId, now);
  }
}
