import { cookies } from "next/headers";
import { db } from "@/server/db";
import { getCurrentMembership } from "@/server/home/my-tournaments";

export const SELECTED_TOURNAMENT_COOKIE = "sq_tournament";
export const SELECTED_TOURNAMENT_MAX_AGE_S = 365 * 24 * 60 * 60;

/** The player's ACTIVE membership in this tournament (not archived), or null. */
async function findActiveMembership(userId: string, tournamentId: string) {
  const m = await db.teamMember.findFirst({
    where: { userId, tournamentId, status: "ACTIVE", tournament: { status: { not: "ARCHIVED" } } },
    include: { team: true, tournament: true },
  });
  return m ? { tournament: m.tournament, team: m.team } : null;
}

/** Whether the player may select this tournament (an active member of a non-archived one). */
export async function canSelectTournament(userId: string, tournamentId: string) {
  return (await findActiveMembership(userId, tournamentId)) !== null;
}

/**
 * The membership My Team and Voyage show: the one in the selected tournament when the player is
 * still an active member there, else (stale, foreign or missing id) the current default.
 */
export async function getSelectedMembership(userId: string, cookieValue?: string | null) {
  if (cookieValue) {
    const selected = await findActiveMembership(userId, cookieValue);
    if (selected) return selected;
  }
  return getCurrentMembership(userId);
}

/** `getSelectedMembership` with the `sq_tournament` cookie of the current request. */
export async function getSelectedMembershipFromCookie(userId: string) {
  const value = (await cookies()).get(SELECTED_TOURNAMENT_COOKIE)?.value;
  return getSelectedMembership(userId, value);
}
