import { chestMomentKey, COLLECTIBLE_ART } from "@/lib/art/collectibles";
import { teamCollectibles } from "@/lib/collectibles/team";
import type { TeamCollectiblesView } from "@/server/collectibles/team-collectibles";
import { db } from "@/server/db";

export type MyTournamentCollectibles = {
  tournamentId: string;
  tournamentName: string;
  teamName: string;
  /** The team's collectibles now; chests count as seen (the profile never plays the opening). */
  team: TeamCollectiblesView;
};

/**
 * The player's collectibles per tournament with an active membership, newest tournament first
 * (My Profile, S-85). Derived from each team's current progress, so they go away with it.
 */
export async function getMyCollectibles(userId: string): Promise<MyTournamentCollectibles[]> {
  const memberships = await db.teamMember.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      tournament: { select: { id: true, name: true, seasonStartAt: true } },
      team: { select: { id: true, name: true, progressBp: true, finishedAt: true } },
    },
  });
  return memberships
    .sort((a, b) => b.tournament.seasonStartAt.getTime() - a.tournament.seasonStartAt.getTime())
    .map(({ tournament, team }) => {
      const owned = teamCollectibles({
        progressBp: team.progressBp,
        finished: team.finishedAt !== null,
      });
      return {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        teamName: team.name,
        team: {
          mapFragments: owned.mapFragments.map((percent) => ({
            percent,
            artKey: COLLECTIBLE_ART.mapFragment,
          })),
          treasureChests: owned.treasureChests.map((chest) => ({
            chest,
            artKey: COLLECTIBLE_ART.treasureChest,
            momentKey: chestMomentKey(team.id, chest),
            seen: true,
          })),
          voyageMapComplete: owned.voyageMapComplete,
        },
      };
    });
}
