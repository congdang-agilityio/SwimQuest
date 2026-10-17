import type { Team, Tournament } from "@prisma/client";
import { effectiveStatus, isJoiningOpen, type TournamentStatus } from "@/lib/tournaments/lifecycle";
import { db } from "@/server/db";
import { listTeamsWithCounts } from "@/server/teams/manage";

export type JoinTeamSummary = Pick<Team, "id" | "name" | "emblemKey">;

export type JoinView = {
  tournament: Pick<
    Tournament,
    "id" | "name" | "description" | "seasonStartAt" | "seasonEndAt" | "eligibilityNotes"
  > &
    Pick<Tournament, "bannerImageId" | "logoImageId"> &
    Pick<Tournament, "routeId" | "routeDistanceM"> & { status: TournamentStatus };
  teams: (Pick<Team, "id" | "name" | "emblemKey" | "description" | "memberLimit"> & {
    memberCount: number;
    full: boolean;
  })[];
  myTeam: JoinTeamSummary | null;
  joiningOpen: boolean;
  /** "OFF" when the organizer switched the link off: nobody can join through it (S-34). */
  linkState: "ON" | "OFF";
  /** Why this player may not join at all; "REMOVED_FROM_TOURNAMENT" after a removal after the start (S-41). */
  blockedReason: JoinBlockedReason | null;
};

export type JoinBlockedReason = "REMOVED_FROM_TOURNAMENT";

/** Invite tokens are 43-character base64url strings; anything far off is not looked up. */
export function isTokenShaped(token: unknown): token is string {
  return typeof token === "string" && token.length > 0 && token.length <= 128;
}

const teamSummary = { id: true, name: true, emblemKey: true } as const;

type Client = Pick<typeof db, "teamMember">;

/** The player's ACTIVE team in the tournament, or null (`client` may be a transaction). */
export async function findMyTeam(userId: string, tournamentId: string, client: Client = db) {
  const member = await client.teamMember.findFirst({
    where: { userId, tournamentId, status: "ACTIVE" },
    select: { team: { select: teamSummary } },
  });
  return member?.team ?? null;
}

/**
 * True when the player's latest membership in the tournament ended with a removal after the
 * start (S-41 AC 3): they cannot join it again through any link. A later membership (the
 * organizer adding them back, S-42) lifts this.
 */
export async function isRemovedFromTournament(
  userId: string,
  tournamentId: string,
  client: Client = db,
) {
  const latest = await client.teamMember.findFirst({
    where: { userId, tournamentId },
    orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
    select: { endReason: true },
  });
  return latest?.endReason === "REMOVED_AFTER_START";
}

/**
 * What an invite link opens (story S-07, FR-28): the tournament summary, its teams with active
 * member counts and full flags, the player's current team and whether joining is open (BR-33,
 * `isJoiningOpen` at `now`). Unknown or malformed tokens return null. A draft or finished
 * tournament still shows, with `joiningOpen: false`. A switched-off link shows `linkState: "OFF"`
 * and `joiningOpen: false`; a replaced (old) token is unknown. A player removed after the start
 * gets `blockedReason: "REMOVED_FROM_TOURNAMENT"` and `joiningOpen: false`.
 */
export async function getJoinView(
  userId: string,
  token: unknown,
  now: Date = new Date(),
): Promise<JoinView | null> {
  if (!isTokenShaped(token)) return null;
  const t = await db.tournament.findUnique({ where: { inviteToken: token } });
  if (!t) return null;
  return buildJoinView(userId, t, t.inviteEnabled, now);
}

/**
 * The join view of tournament `t` for `userId`. `canEnter` is whether the entry point itself lets
 * the player in (the invite link is switched on, or the tournament is public); `linkState`
 * reports the invite link switch either way.
 */
export async function buildJoinView(
  userId: string,
  t: Tournament,
  canEnter: boolean,
  now: Date,
): Promise<JoinView> {
  const [{ teams }, myTeam, removed] = await Promise.all([
    listTeamsWithCounts(t.id),
    findMyTeam(userId, t.id),
    isRemovedFromTournament(userId, t.id),
  ]);
  return {
    tournament: {
      id: t.id,
      name: t.name,
      description: t.description,
      status: effectiveStatus(t, now),
      seasonStartAt: t.seasonStartAt,
      seasonEndAt: t.seasonEndAt,
      eligibilityNotes: t.eligibilityNotes,
      bannerImageId: t.bannerImageId,
      logoImageId: t.logoImageId,
      routeId: t.routeId,
      routeDistanceM: t.routeDistanceM,
    },
    teams: teams.map(({ id, name, emblemKey, description, memberCount, memberLimit }) => {
      const full = memberCount >= memberLimit;
      return { id, name, emblemKey, description, memberCount, memberLimit, full };
    }),
    myTeam,
    joiningOpen: !removed && canEnter && t.archivedAt === null && isJoiningOpen(t, now),
    linkState: t.inviteEnabled ? "ON" : "OFF",
    blockedReason: removed ? "REMOVED_FROM_TOURNAMENT" : null,
  };
}
