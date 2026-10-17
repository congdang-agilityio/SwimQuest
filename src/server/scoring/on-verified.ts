import type { SwimResult } from "@prisma/client";
import { checkPersonalBadgesOnVerified } from "@/server/badges/personal-rules";
import type { Tx } from "@/server/checks/run-checks";
import { updateTeamProgress } from "@/server/progress/update-team-progress";
import { awardBonuses } from "./award-bonuses";
import { awardDistancePoints } from "./award-distance-points";
import { syncSwimXp } from "@/server/xp/sync-swim-xp";
import { recalculateSettledWeek } from "./settle-week";

export type TeamRef = { tournamentId: string; teamId: string };

/**
 * What a newly VERIFIED result earns, inside the caller's transaction: distance points (S-13),
 * bonuses (S-20), personal badges (S-48), a settled week's multiplier (S-21) and the swim's XP
 * once (S-51). Returns the teams whose points changed, for one `refreshTeams` at the end.
 */
export async function awardVerified(tx: Tx, result: SwimResult, now: Date): Promise<TeamRef[]> {
  if (result.status !== "VERIFIED") return [];
  await awardDistancePoints(tx, result);
  await awardBonuses(tx, result);
  await checkPersonalBadgesOnVerified(tx, result);
  await syncSwimXp(tx, result.swimId);
  const teams = await recalculateSettledWeek(tx, result, now);
  const { tournamentId } = result;
  return [result.teamId, ...teams].map((teamId) => ({ tournamentId, teamId }));
}

/** Refreshes each team's progress (S-19) once, in ascending `teamId` order (lock order). */
export async function refreshTeams(tx: Tx, teams: TeamRef[], now: Date): Promise<void> {
  const byId = new Map(teams.map((t) => [t.teamId, t.tournamentId]));
  const ordered = [...byId].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [teamId, tournamentId] of ordered) {
    await updateTeamProgress(tx, tournamentId, teamId, now);
  }
}

/** The hook for one newly VERIFIED result (a review approval): award, then refresh. */
export async function onVerified(tx: Tx, result: SwimResult, now: Date = new Date()) {
  await refreshTeams(tx, await awardVerified(tx, result, now), now);
}
