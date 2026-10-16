import { Prisma } from "@prisma/client";
import { isJoiningOpen, type LifecycleTournament } from "@/lib/tournaments/lifecycle";
import { db } from "@/server/db";
import {
  findMyTeam,
  isRemovedFromTournament,
  isTokenShaped,
  type JoinTeamSummary,
} from "./join-view";

export type JoinErrorCode =
  | "JOIN_CLOSED"
  | "LINK_OFF"
  | "TEAM_FULL"
  | "ALREADY_MEMBER"
  | "REMOVED_FROM_TOURNAMENT"
  | "NOT_FOUND";

/** A refused join. `ALREADY_MEMBER` carries the player's current team. */
export class JoinError extends Error {
  readonly status: 403 | 404 | 409 | 410;
  constructor(
    readonly code: JoinErrorCode,
    readonly team?: JoinTeamSummary,
  ) {
    super(code);
    this.status =
      code === "NOT_FOUND"
        ? 404
        : code === "LINK_OFF"
          ? 410
          : code === "REMOVED_FROM_TOURNAMENT"
            ? 403
            : 409;
  }
}

export type JoinResult = { tournamentId: string; team: JoinTeamSummary };

type LockedTeam = JoinTeamSummary & { memberLimit: number };
type LockedTournament = LifecycleTournament & {
  inviteToken: string | null;
  inviteEnabled: boolean;
};

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * Joins the chosen team of the invite link's tournament at once, with no approval (story S-07,
 * Q-49). One transaction locks the team row (`FOR UPDATE`), so concurrent joins of the same team
 * run one after the other and the last free place goes to exactly one of them (`TEAM_FULL` for
 * the other). Checks, in order: the link is still current and switched on (S-34; read under the
 * same lock, so a replace or switch-off takes effect at once), joining open at `now` (BR-33), the team belongs to the
 * tournament, the player is not already active in it, was not removed from it after the start
 * (S-41, `REMOVED_FROM_TOURNAMENT`), the team has room. The partial unique
 * index on active memberships is the last guard: its violation also maps to `ALREADY_MEMBER`.
 */
export async function joinTeam(
  userId: string,
  token: unknown,
  teamId: unknown,
  now: Date = new Date(),
): Promise<JoinResult> {
  if (!isTokenShaped(token) || typeof teamId !== "string" || teamId.length === 0) {
    throw new JoinError("NOT_FOUND");
  }
  const tournament = await db.tournament.findUnique({
    where: { inviteToken: token },
    select: { id: true },
  });
  if (!tournament) throw new JoinError("NOT_FOUND");
  const tournamentId = tournament.id;

  try {
    return await db.$transaction(async (tx) => {
      const [team] = await tx.$queryRaw<LockedTeam[]>`
        SELECT "id", "name", "emblemKey", "memberLimit" FROM "Team"
        WHERE "id" = ${teamId} AND "tournamentId" = ${tournamentId} FOR UPDATE`;
      if (!team) throw new JoinError("NOT_FOUND");
      const [lifecycle] = await tx.$queryRaw<LockedTournament[]>`
        SELECT "status"::text, "seasonStartAt", "seasonEndAt", "startChoiceDeadlineAt",
          "inviteToken", "inviteEnabled"
        FROM "Tournament" WHERE "id" = ${tournamentId} FOR SHARE`;
      if (!lifecycle || lifecycle.inviteToken !== token) throw new JoinError("NOT_FOUND");
      if (!lifecycle.inviteEnabled) throw new JoinError("LINK_OFF");
      if (!isJoiningOpen(lifecycle, now)) throw new JoinError("JOIN_CLOSED");

      const current = await findMyTeam(userId, tournamentId, tx);
      if (current) throw new JoinError("ALREADY_MEMBER", current);
      if (await isRemovedFromTournament(userId, tournamentId, tx)) {
        throw new JoinError("REMOVED_FROM_TOURNAMENT");
      }
      const members = await tx.teamMember.count({ where: { teamId, status: "ACTIVE" } });
      if (members >= team.memberLimit) throw new JoinError("TEAM_FULL");

      await tx.teamMember.create({ data: { teamId, tournamentId, userId } });
      return { tournamentId, team: { id: team.id, name: team.name, emblemKey: team.emblemKey } };
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const team = await findMyTeam(userId, tournamentId);
    throw new JoinError("ALREADY_MEMBER", team ?? undefined);
  }
}
