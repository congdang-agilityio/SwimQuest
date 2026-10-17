import { ForbiddenError, NotFoundError, requireCaptain } from "@/server/auth/roles";
import { db } from "@/server/db";

/**
 * The tournament's join link with the captain's team preselected, `<origin>/join/<token>?team=<id>`.
 * Only the team's captain gets it; anyone else, and a switched-off or missing link, gets `null`,
 * so the token never reaches a member's page.
 */
export async function getCaptainInviteLink(
  userId: string,
  teamId: string,
  origin: string,
): Promise<string | null> {
  let tournamentId: string;
  try {
    tournamentId = (await requireCaptain(userId, teamId)).tournamentId;
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) return null;
    throw err;
  }
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { inviteToken: true, inviteEnabled: true },
  });
  if (!tournament?.inviteEnabled || !tournament.inviteToken) return null;
  return `${origin}/join/${tournament.inviteToken}?team=${encodeURIComponent(teamId)}`;
}
