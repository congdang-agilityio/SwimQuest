import { randomBytes } from "node:crypto";
import { canSeeField, resolvePrivacy } from "@/lib/privacy";
import { getRoute } from "@/lib/routes";
import { db } from "@/server/db";

export type FinishShareResult =
  { ok: true; token: string } | { ok: false; error: "FORBIDDEN" | "NOT_FINISHED" };

/** A teammate on the public finish: name and avatar only when the owner shows them to anyone. */
export type PublicFinishMember = {
  /** Null when the owner's name is not public: the page shows "A swimmer". */
  displayName: string | null;
  /** Null when the owner's avatar is not public. */
  avatar: { imageId: string | null; defaultKey: string | null } | null;
};

/**
 * The public, privacy-filtered view of a team's finish (S-82). It has no ids, email, swims,
 * tracks, notes or per-player stats: only the tournament and team names, the route and the
 * team total.
 */
export type PublicFinish = {
  tournamentName: string;
  team: { name: string; emblemKey: string };
  route: {
    id: string;
    /** Message key of the route name, e.g. `routes.route01.name`. */
    nameKey: string;
    /** Message key of the team's start destination, when known. */
    startKey: string | null;
    /** Message key of the finish destination (Lý Sơn). */
    finishKey: string | null;
  };
  /** False when a correction took the team back below the finish (BR-32 note). */
  finished: boolean;
  finishedAt: Date | null;
  /** When the finish was lost; null while the team is at the finish. */
  finishLostAt: Date | null;
  /** Verified counted metres (DISTANCE entries and their reversals). */
  totalM: number;
  /** Team points, all kinds. */
  points: number;
  members: PublicFinishMember[];
};

const TOKEN_BYTES = 24;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/**
 * The share token of a finished team for one of its active members. The token is created once
 * (24 random bytes, base64url) and the same one is returned on later calls. A player who is not
 * an active member gets FORBIDDEN; a team without `finishedAt` gets NOT_FINISHED.
 */
export async function getOrCreateFinishShare(
  userId: string,
  teamId: string,
): Promise<FinishShareResult> {
  if (typeof userId !== "string" || !userId || typeof teamId !== "string" || !teamId) {
    return { ok: false, error: "FORBIDDEN" };
  }
  const member = await db.teamMember.findFirst({
    where: { teamId, userId, status: "ACTIVE" },
    select: { team: { select: { finishedAt: true, shareToken: true } } },
  });
  if (!member) return { ok: false, error: "FORBIDDEN" };
  if (!member.team.finishedAt) return { ok: false, error: "NOT_FINISHED" };
  if (member.team.shareToken) return { ok: true, token: member.team.shareToken };

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  // Only set the token when none exists, so two concurrent calls end with one token.
  await db.team.updateMany({
    where: { id: teamId, shareToken: null },
    data: { shareToken: token },
  });
  const row = await db.team.findUnique({ where: { id: teamId }, select: { shareToken: true } });
  return row?.shareToken ? { ok: true, token: row.shareToken } : { ok: false, error: "FORBIDDEN" };
}

/** The public finish behind a share token, or null for an unknown token. */
export async function getPublicFinish(token: string): Promise<PublicFinish | null> {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  const team = await db.team.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      tournamentId: true,
      name: true,
      emblemKey: true,
      startDestination: true,
      finishedAt: true,
      finishLostAt: true,
      tournament: { select: { name: true, routeId: true } },
      members: {
        where: { status: "ACTIVE" },
        orderBy: { joinedAt: "asc" },
        select: {
          user: {
            select: {
              displayName: true,
              avatarImageId: true,
              avatarDefaultKey: true,
              privacy: true,
            },
          },
        },
      },
    },
  });
  if (!team) return null;

  const [points, distance] = await Promise.all([
    db.pointsEntry.aggregate({
      where: { tournamentId: team.tournamentId, teamId: team.id },
      _sum: { points: true },
    }),
    db.pointsEntry.aggregate({
      where: {
        tournamentId: team.tournamentId,
        teamId: team.id,
        kind: { in: ["DISTANCE", "REVERSAL"] },
      },
      _sum: { countedM: true },
    }),
  ]);

  const route = getRoute(team.tournament.routeId);
  const destination = (slug: string | null) =>
    route?.destinations.find((d) => (slug ? d.slug === slug : d.isFinish))?.nameKey ?? null;

  return {
    tournamentName: team.tournament.name,
    team: { name: team.name, emblemKey: team.emblemKey },
    route: {
      id: team.tournament.routeId,
      nameKey: `routes.${team.tournament.routeId}.name`,
      startKey: team.startDestination ? destination(team.startDestination) : null,
      finishKey: destination(null),
    },
    finished: team.finishedAt !== null,
    finishedAt: team.finishedAt,
    finishLostAt: team.finishedAt ? null : team.finishLostAt,
    totalM: Math.max(0, distance._sum.countedM ?? 0),
    points: points._sum.points ?? 0,
    // Anyone with the link may open the page, so every member is seen as OTHER.
    members: team.members.map(({ user }) => {
      const privacy = resolvePrivacy(user.privacy);
      return {
        displayName: canSeeField(privacy, "displayName", "OTHER") ? user.displayName : null,
        avatar: canSeeField(privacy, "avatar", "OTHER")
          ? { imageId: user.avatarImageId, defaultKey: user.avatarDefaultKey }
          : null,
      };
    }),
  };
}
