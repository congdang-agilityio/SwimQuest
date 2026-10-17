import { db } from "@/server/db";
import { canSeeField, resolvePrivacy, type PrivacyField, type Relation } from "@/lib/privacy";
import { getPlayerStats } from "@/server/profile/stats";
import { PUBLIC_PLAYER_SELECT } from "@/server/users/public-player";
import { isRegionCode } from "@/lib/regions";
import { listUserBadges } from "@/server/badges/list";

export type PublicProfileStats = {
  verifiedSwims: number;
  verifiedDistanceM: number;
  activeDays: number;
  tournamentsJoined: number;
  teams: number;
  badges: number;
};

export type PublicProfileBadge = {
  id: string;
  kind: string;
  awardedAt: Date;
  tournament: { id: string; name: string };
};

/**
 * What a viewer may see of a player. A part the viewer may not see is `null`. There is no email,
 * location detail, track, swim id, badge reason or moderation note field in this type at all.
 */
export type PublicProfile = {
  id: string;
  relation: Relation;
  displayName: string | null;
  avatar: {
    imageId: string | null;
    defaultKey: string | null;
    coverImageId: string | null;
  } | null;
  bio: string | null;
  regionCode: string | null;
  goals: { text: string | null; distanceM: number | null; disciplines: string[] } | null;
  stats: PublicProfileStats | null;
  badges: PublicProfileBadge[] | null;
};

/** How the viewer relates to the owner, from memberships. A missing viewer is OTHER. */
async function computeRelation(viewerId: string | null, ownerId: string): Promise<Relation> {
  if (!viewerId) return "OTHER";
  if (viewerId === ownerId) return "SELF";
  const rows = await db.teamMember.findMany({
    where: { userId: { in: [viewerId, ownerId] } },
    select: { userId: true, teamId: true, tournamentId: true, status: true },
  });
  const mine = rows.filter((r) => r.userId === viewerId);
  const theirs = rows.filter((r) => r.userId === ownerId);
  const teammate = mine.some(
    (a) =>
      a.status === "ACTIVE" && theirs.some((b) => b.status === "ACTIVE" && b.teamId === a.teamId),
  );
  if (teammate) return "TEAMMATE";
  const shares = mine.some((a) => theirs.some((b) => b.tournamentId === a.tournamentId));
  return shares ? "SHARES_TOURNAMENT" : "OTHER";
}

/**
 * The player's profile filtered by their privacy settings for this viewer (FR-16). With
 * `asOutsider` the relation is forced to OTHER, for the owner's "preview as others" view.
 * Returns null for an unknown player. Email is never part of the result.
 */
export async function getPublicProfile(
  viewerId: string | null,
  userId: string,
  options: { asOutsider?: boolean } = {},
): Promise<PublicProfile | null> {
  if (typeof userId !== "string" || !userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      ...PUBLIC_PLAYER_SELECT,
      coverImageId: true,
      bio: true,
      regionCode: true,
      goalsText: true,
      goalDistanceM: true,
      disciplines: true,
      privacy: true,
    },
  });
  if (!user) return null;

  const relation = options.asOutsider ? "OTHER" : await computeRelation(viewerId, userId);
  const privacy = resolvePrivacy(user.privacy);
  const can = (field: PrivacyField) => canSeeField(privacy, field, relation);

  const [stats, badges] = await Promise.all([
    can("stats") ? getPlayerStats(userId) : null,
    can("badges") ? listUserBadges(userId) : null,
  ]);

  return {
    id: user.id,
    relation,
    displayName: can("displayName") ? user.displayName : null,
    avatar: can("avatar")
      ? {
          imageId: user.avatarImageId,
          defaultKey: user.avatarDefaultKey,
          coverImageId: user.coverImageId,
        }
      : null,
    bio: can("bio") ? user.bio : null,
    regionCode: can("region") && isRegionCode(user.regionCode) ? user.regionCode : null,
    goals: can("goals")
      ? { text: user.goalsText, distanceM: user.goalDistanceM, disciplines: user.disciplines }
      : null,
    stats: stats && {
      verifiedSwims: stats.verifiedSwims,
      verifiedDistanceM: stats.verifiedDistanceM,
      activeDays: stats.activeDays,
      tournamentsJoined: stats.tournamentsJoined,
      teams: stats.teams,
      badges: stats.badges,
    },
    badges:
      badges &&
      badges.map((b) => ({
        id: b.id,
        kind: b.kind,
        awardedAt: b.awardedAt,
        tournament: b.tournament,
      })),
  };
}
