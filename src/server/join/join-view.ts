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
    Pick<Tournament, "routeId" | "routeDistanceM"> & { status: TournamentStatus };
  teams: (Pick<Team, "id" | "name" | "emblemKey" | "description" | "memberLimit"> & {
    memberCount: number;
    full: boolean;
  })[];
  myTeam: JoinTeamSummary | null;
  joiningOpen: boolean;
  /** "OFF" when the organizer switched the link off: nobody can join through it (S-34). */
  linkState: "ON" | "OFF";
};

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
 * What an invite link opens (story S-07, FR-28): the tournament summary, its teams with active
 * member counts and full flags, the player's current team and whether joining is open (BR-33,
 * `isJoiningOpen` at `now`). Unknown or malformed tokens return null. A draft or finished
 * tournament still shows, with `joiningOpen: false`. A switched-off link shows `linkState: "OFF"`
 * and `joiningOpen: false`; a replaced (old) token is unknown.
 */
export async function getJoinView(
  userId: string,
  token: unknown,
  now: Date = new Date(),
): Promise<JoinView | null> {
  if (!isTokenShaped(token)) return null;
  const t = await db.tournament.findUnique({ where: { inviteToken: token } });
  if (!t) return null;

  const [{ teams }, myTeam] = await Promise.all([
    listTeamsWithCounts(t.id),
    findMyTeam(userId, t.id),
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
      routeId: t.routeId,
      routeDistanceM: t.routeDistanceM,
    },
    teams: teams.map(({ id, name, emblemKey, description, memberCount, memberLimit }) => {
      const full = memberCount >= memberLimit;
      return { id, name, emblemKey, description, memberCount, memberLimit, full };
    }),
    myTeam,
    joiningOpen: t.inviteEnabled && isJoiningOpen(t, now),
    linkState: t.inviteEnabled ? "ON" : "OFF",
  };
}
