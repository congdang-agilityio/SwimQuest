import { routeProgress, type RouteProgress } from "@/lib/scoring/progress";
import { db } from "@/server/db";
import { getCurrentMembership } from "@/server/home/my-tournaments";
import { getPlayerTotals } from "@/server/scoring/team-points";
import { getLevels } from "@/server/xp/level";
import {
  PUBLIC_PLAYER_SELECT,
  toPublicPlayer,
  type PublicPlayer,
} from "@/server/users/public-player";

export type MyTeamMember = PublicPlayer & {
  verifiedKm: number;
  points: number;
  isCaptain: boolean;
  level: number;
};

export type MyTeamView = {
  tournament: { id: string; name: string; routeId: string };
  team: { name: string; emblemKey: string; description: string | null; memberLimit: number };
  captain: PublicPlayer | null;
  start: {
    slug: string;
    setBy: "CAPTAIN" | "ORGANIZER" | "AUTOMATIC" | null;
    setAt: Date | null;
  } | null;
  teamPoints: number;
  progress: RouteProgress;
  /** When the team first finished the route (100%); null while unfinished. */
  finishedAt: Date | null;
  memberCount: number;
  roster: MyTeamMember[];
};

/**
 * Everything the My Team page shows for the player's current team (story S-19). Teammates'
 * contributions are always included (Q-31); users are read with `PUBLIC_PLAYER_SELECT`, so
 * no email leaves this function (NFR-05). Returns null without a current team.
 */
export async function getMyTeamView(userId: string): Promise<MyTeamView | null> {
  const current = await getCurrentMembership(userId);
  if (!current) return null;
  const { tournament, team } = current;

  const members = await db.teamMember.findMany({
    where: { teamId: team.id, tournamentId: tournament.id, status: "ACTIVE" },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: { user: { select: PUBLIC_PLAYER_SELECT } },
  });
  const totals = await getPlayerTotals(
    tournament.id,
    members.map((m) => m.user.id),
  );
  const levels = await getLevels(members.map((m) => m.user.id));
  const roster = members.map(({ user }): MyTeamMember => {
    const t = totals.get(user.id) ?? { points: 0, countedM: 0 };
    return {
      ...toPublicPlayer(user),
      verifiedKm: t.countedM / 1000,
      points: t.points,
      isCaptain: user.id === team.captainUserId,
      level: levels.get(user.id)?.level ?? 1,
    };
  });
  const teamPoints = roster.reduce((sum, m) => sum + m.points, 0);
  const captain = roster.find((m) => m.isCaptain);

  return {
    tournament: { id: tournament.id, name: tournament.name, routeId: tournament.routeId },
    team: {
      name: team.name,
      emblemKey: team.emblemKey,
      description: team.description,
      memberLimit: team.memberLimit,
    },
    captain: captain ? toPublicPlayer(captain) : null,
    start: team.startDestination
      ? { slug: team.startDestination, setBy: team.startSetBy, setAt: team.startSetAt }
      : null,
    teamPoints,
    progress: routeProgress({
      teamPoints,
      routeDistanceM: tournament.routeDistanceM,
      pointsPerKm: tournament.pointsPerKm,
    }),
    finishedAt: team.finishedAt,
    memberCount: roster.length,
    roster,
  };
}
