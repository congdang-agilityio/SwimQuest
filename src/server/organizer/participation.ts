import { vnWeekRange, vnWeekStart } from "@/lib/time/vn";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import {
  listUnassignedPlayers,
  type UnassignedPlayer,
} from "@/server/organizer/unassigned-players";
import {
  PUBLIC_PLAYER_SELECT,
  toPublicPlayer,
  type PublicPlayer,
} from "@/server/users/public-player";

/** A verified swim of at least this many metres makes a member active for the week. */
export const ACTIVE_SWIM_MIN_M = 500;

/**
 * Verified swims of at least ACTIVE_SWIM_MIN_M that started in [start, end), as distinct
 * team/player pairs of teams that still have active members. The one "active member" rule.
 */
export function findActiveSwimmers(tournamentId: string, start: Date, end: Date) {
  return db.swimResult.findMany({
    where: {
      tournamentId,
      status: "VERIFIED",
      swim: { distanceM: { gte: ACTIVE_SWIM_MIN_M }, startedAt: { gte: start, lt: end } },
      team: { members: { some: { status: "ACTIVE" } } },
    },
    distinct: ["teamId", "userId"],
    select: { teamId: true, userId: true },
  });
}

export type ConsoleTeamMember = PublicPlayer & { isCaptain: boolean; joinedAt: Date };

export type ConsoleTeam = {
  teamId: string;
  name: string;
  emblemKey: string;
  members: ConsoleTeamMember[];
  /** Public fields of the captain, or null while the team has none. */
  captain: PublicPlayer | null;
  memberLimit: number;
  freePlaces: number;
  progressBp: number;
  finished: boolean;
  /** Active members with a verified swim of 500 m or more this Vietnam week (Monday to Sunday). */
  activeMembersThisWeek: number;
};

export type ConsoleTeams = {
  tournamentId: string;
  teams: ConsoleTeam[];
  unassignedPlayers: UnassignedPlayer[];
};

/**
 * Participation data of the organizer console (story S-65, AC 3 and AC 5): every team with its
 * active members, captain, free places, progress and weekly activity, plus players without a
 * team. Three bounded queries regardless of the team count; public player fields only (NFR-05).
 * Organizer only (throws the role errors of `requireOrganizer`).
 */
export async function getConsoleTeams(
  organizerId: string,
  tournamentId: string,
  now: Date = new Date(),
): Promise<ConsoleTeams> {
  await requireOrganizer(organizerId, tournamentId);
  const { start, end } = vnWeekRange(vnWeekStart(now));
  const [teams, active, unassignedPlayers] = await Promise.all([
    db.team.findMany({
      where: { tournamentId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        emblemKey: true,
        memberLimit: true,
        captainUserId: true,
        progressBp: true,
        finishedAt: true,
        members: {
          where: { status: "ACTIVE" },
          orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
          select: { joinedAt: true, user: { select: PUBLIC_PLAYER_SELECT } },
        },
      },
    }),
    findActiveSwimmers(tournamentId, start, end),
    listUnassignedPlayers(organizerId, tournamentId),
  ]);

  const swimmers = new Set(active.map((r) => `${r.teamId}:${r.userId}`));
  return {
    tournamentId,
    teams: teams.map((t) => {
      const members = t.members.map(({ joinedAt, user }) => ({
        ...toPublicPlayer(user),
        isCaptain: user.id === t.captainUserId,
        joinedAt,
      }));
      const captain = members.find((m) => m.isCaptain);
      return {
        teamId: t.id,
        name: t.name,
        emblemKey: t.emblemKey,
        members,
        captain: captain ? toPublicPlayer(captain) : null,
        memberLimit: t.memberLimit,
        freePlaces: Math.max(0, t.memberLimit - members.length),
        progressBp: t.progressBp,
        finished: t.finishedAt !== null,
        activeMembersThisWeek: members.filter((m) => swimmers.has(`${t.id}:${m.id}`)).length,
      };
    }),
    unassignedPlayers,
  };
}
