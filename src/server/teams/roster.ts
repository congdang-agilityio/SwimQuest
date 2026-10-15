import { NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import {
  PUBLIC_PLAYER_SELECT,
  toPublicPlayer,
  type PublicPlayer,
} from "@/server/users/public-player";

/** A team member as the organizer's roster shows them: public fields only, never an email. */
export type RosterMember = PublicPlayer & { isCaptain: boolean; joinedAt: Date };

/**
 * The team's active members, oldest first, with who is captain (story S-08, AC 1). Users are
 * read with `PUBLIC_PLAYER_SELECT` (NFR-05). Throws NotFoundError for an unknown team.
 */
export async function getTeamRoster(teamId: string): Promise<RosterMember[]> {
  const team =
    typeof teamId === "string" && teamId.length > 0
      ? await db.team.findUnique({
          where: { id: teamId },
          select: {
            captainUserId: true,
            members: {
              where: { status: "ACTIVE" },
              orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
              select: { joinedAt: true, user: { select: PUBLIC_PLAYER_SELECT } },
            },
          },
        })
      : null;
  if (!team) throw new NotFoundError();
  return team.members.map(({ joinedAt, user }) => ({
    ...toPublicPlayer(user),
    isCaptain: user.id === team.captainUserId,
    joinedAt,
  }));
}
