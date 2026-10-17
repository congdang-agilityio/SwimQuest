import { Prisma } from "@prisma/client";
import { isJoiningOpen, type LifecycleTournament } from "@/lib/tournaments/lifecycle";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
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
  | "NOT_PUBLIC"
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
      code === "NOT_FOUND" || code === "NOT_PUBLIC"
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
/** The tournament row as read under the join lock; each entry point checks its own access. */
export type LockedTournament = LifecycleTournament & {
  inviteToken: string | null;
  inviteEnabled: boolean;
  visibility: "PUBLIC" | "INVITE_ONLY" | null;
  archivedAt: Date | null;
};

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * The join rules shared by the invite link (S-07) and the public join (S-30), inside one
 * transaction. Locks the team row (`FOR UPDATE`), so concurrent joins of the same team run one
 * after the other and the last free place goes to exactly one of them (`TEAM_FULL` for the
 * other). Reads the tournament under the same lock and lets `admit` refuse it for the entry
 * point's own reason (link replaced or off, not public), so a switch takes effect at once. Then
 * checks, in order: joining open at `now` (BR-33), the player is not already active in it, was
 * not removed from it after the start (S-41, `REMOVED_FROM_TOURNAMENT`), the team has room.
 */
export async function joinTeamInTournament(
  tx: Tx,
  userId: string,
  tournamentId: string,
  teamId: string,
  now: Date,
  admit: (tournament: LockedTournament) => void,
): Promise<JoinResult> {
  const [team] = await tx.$queryRaw<LockedTeam[]>`
    SELECT "id", "name", "emblemKey", "memberLimit" FROM "Team"
    WHERE "id" = ${teamId} AND "tournamentId" = ${tournamentId} FOR UPDATE`;
  if (!team) throw new JoinError("NOT_FOUND");
  const [lifecycle] = await tx.$queryRaw<LockedTournament[]>`
    SELECT "status"::text, "seasonStartAt", "seasonEndAt", "startChoiceDeadlineAt",
      "inviteToken", "inviteEnabled", "visibility"::text, "archivedAt"
    FROM "Tournament" WHERE "id" = ${tournamentId} FOR SHARE`;
  if (!lifecycle) throw new JoinError("NOT_FOUND");
  admit(lifecycle);
  if (lifecycle.archivedAt || !isJoiningOpen(lifecycle, now)) throw new JoinError("JOIN_CLOSED");

  const current = await findMyTeam(userId, tournamentId, tx);
  if (current) throw new JoinError("ALREADY_MEMBER", current);
  if (await isRemovedFromTournament(userId, tournamentId, tx)) {
    throw new JoinError("REMOVED_FROM_TOURNAMENT");
  }
  const members = await tx.teamMember.count({ where: { teamId, status: "ACTIVE" } });
  if (members >= team.memberLimit) throw new JoinError("TEAM_FULL");

  await tx.teamMember.create({ data: { teamId, tournamentId, userId } });
  await emitEvent(tx, { type: "TEAM_JOINED", payload: { tournamentId, teamId, userId } });
  return { tournamentId, team: { id: team.id, name: team.name, emblemKey: team.emblemKey } };
}

/**
 * Runs `joinTeamInTournament` in its own transaction. The partial unique index on active
 * memberships is the last guard: its violation maps to `ALREADY_MEMBER` with the current team.
 */
export async function runJoin(
  userId: string,
  tournamentId: string,
  teamId: string,
  now: Date,
  admit: (tournament: LockedTournament) => void,
): Promise<JoinResult> {
  try {
    return await db.$transaction((tx) =>
      joinTeamInTournament(tx, userId, tournamentId, teamId, now, admit),
    );
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const team = await findMyTeam(userId, tournamentId);
    throw new JoinError("ALREADY_MEMBER", team ?? undefined);
  }
}

/**
 * Joins the chosen team of the invite link's tournament at once, with no approval (story S-07,
 * Q-49), under the shared rules of `joinTeamInTournament`. The link must still be current and
 * switched on (S-34; read under the join lock, so a replace or switch-off takes effect at once).
 * The tournament's visibility does not matter here.
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

  return runJoin(userId, tournament.id, teamId, now, (locked) => {
    if (locked.inviteToken !== token) throw new JoinError("NOT_FOUND");
    if (!locked.inviteEnabled) throw new JoinError("LINK_OFF");
  });
}
