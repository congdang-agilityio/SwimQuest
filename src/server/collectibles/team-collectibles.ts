import { chestMomentKey, COLLECTIBLE_ART, type CollectibleArtKey } from "@/lib/art/collectibles";
import {
  teamCollectibles,
  type MapFragmentPercent,
  type TreasureChestKey,
} from "@/lib/collectibles/team";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { unseenKeys } from "@/server/moments/seen";

export type TeamCollectiblesView = {
  mapFragments: { percent: MapFragmentPercent; artKey: CollectibleArtKey }[];
  treasureChests: {
    chest: TreasureChestKey;
    artKey: CollectibleArtKey;
    /** The `SeenMoment` key the client marks when the chest opens. */
    momentKey: string;
    /** True when the viewer already saw this chest open. */
    seen: boolean;
  }[];
  voyageMapComplete: boolean;
};

/**
 * The team's current collectibles for an active member (S-85), always derived from the team's
 * `progressBp` and `finishedAt`. Anyone else gets ForbiddenError (NotFoundError for an unknown
 * team). Collecting only: no points, progress or spend.
 */
export async function getTeamCollectibles(
  viewerId: string,
  teamId: string,
): Promise<TeamCollectiblesView> {
  const team =
    typeof teamId === "string" && teamId.length > 0
      ? await db.team.findUnique({
          where: { id: teamId },
          select: { id: true, tournamentId: true, progressBp: true, finishedAt: true },
        })
      : null;
  if (!team) throw new NotFoundError();
  const member =
    typeof viewerId === "string" && viewerId.length > 0
      ? await db.teamMember.count({
          where: { teamId, tournamentId: team.tournamentId, userId: viewerId, status: "ACTIVE" },
        })
      : 0;
  if (member === 0) throw new ForbiddenError();

  const owned = teamCollectibles({
    progressBp: team.progressBp,
    finished: team.finishedAt !== null,
  });
  const keys = owned.treasureChests.map((c) => chestMomentKey(team.id, c));
  const unseen = new Set(await unseenKeys(viewerId, keys));
  return {
    mapFragments: owned.mapFragments.map((percent) => ({
      percent,
      artKey: COLLECTIBLE_ART.mapFragment,
    })),
    treasureChests: owned.treasureChests.map((chest, i) => ({
      chest,
      artKey: COLLECTIBLE_ART.treasureChest,
      momentKey: keys[i],
      seen: !unseen.has(keys[i]),
    })),
    voyageMapComplete: owned.voyageMapComplete,
  };
}
