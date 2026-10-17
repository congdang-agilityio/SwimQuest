import { routeProgress, type RouteProgress } from "@/lib/scoring/progress";
import { db } from "@/server/db";
import { getSelectedMembership } from "@/server/home/selected-tournament";
import { getPlayerTotals, getTeamPoints } from "@/server/scoring/team-points";
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
export async function getMyTeamView(
  userId: string,
  selectedTournamentId?: string | null,
): Promise<MyTeamView | null> {
  const current = await getSelectedMembership(userId, selectedTournamentId);
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
  // By PointsEntry.teamId (#206): a removed member's swims stay with the team.
  const teamPoints = await getTeamPoints(tournament.id, team.id);
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

export type LastRemoval = {
  teamName: string;
  tournamentName: string;
  afterStart: boolean;
  at: Date;
};

/**
 * The removal My Team explains to a player without a team (story S-43 AC 4): their latest
 * membership ended by an organizer's removal and they have no active membership since.
 */
export async function getLastRemoval(userId: string): Promise<LastRemoval | null> {
  const latest = await db.teamMember.findFirst({
    where: { userId },
    orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
    select: {
      status: true,
      endReason: true,
      endedAt: true,
      team: { select: { name: true } },
      tournament: { select: { name: true } },
    },
  });
  if (!latest || latest.status !== "REMOVED") return null;
  if (latest.endReason !== "REMOVED_BEFORE_START" && latest.endReason !== "REMOVED_AFTER_START") {
    return null;
  }
  return {
    teamName: latest.team.name,
    tournamentName: latest.tournament.name,
    afterStart: latest.endReason === "REMOVED_AFTER_START",
    at: latest.endedAt ?? new Date(0),
  };
}
