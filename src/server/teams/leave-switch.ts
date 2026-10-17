import { Prisma } from "@prisma/client";
import { effectiveStatus, type LifecycleTournament } from "@/lib/tournaments/lifecycle";
import { NotFoundError } from "@/server/auth/roles";
import { lockPlayerSwims, type Tx } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { NotAMemberError } from "./captain";
import { InvalidMoveError, TeamFullError } from "./move-player";

/** The season has started: only the organizer can move players now (S-38 AC 3, FR-36). */
export class SeasonStartedError extends Error {
  readonly status = 409;
  readonly code = "SEASON_STARTED";
}

/** Another switch or join of the same player won the race to an active membership. */
export class MembershipConflictError extends Error {
  readonly status = 409;
  readonly code = "ALREADY_MEMBER";
}

type LockedTeam = {
  id: string;
  tournamentId: string;
  captainUserId: string | null;
  memberLimit: number;
};
export type LeaveSwitchResult = { tournamentId: string; captainCleared: boolean };

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Locks the given team rows in ascending id order (the order every team-locking path uses). */
function lockTeams(tx: Tx, ids: string[]) {
  return tx.$queryRaw<LockedTeam[]>`
    SELECT "id", "tournamentId", "captainUserId", "memberLimit" FROM "Team"
    WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
}

/** Refuses from the season start on (`effectiveStatus` past PUBLISHED), read under a share lock. */
async function assertBeforeStart(tx: Tx, tournamentId: string, now: Date) {
  const [lifecycle] = await tx.$queryRaw<LifecycleTournament[]>`
    SELECT "status"::text, "seasonStartAt", "seasonEndAt", "startChoiceDeadlineAt"
    FROM "Tournament" WHERE "id" = ${tournamentId} FOR SHARE`;
  if (!lifecycle) throw new NotFoundError();
  const status = effectiveStatus(lifecycle, now);
  if (status !== "DRAFT" && status !== "PUBLISHED") throw new SeasonStartedError();
}

/** Ends the player's active membership of the team; a leaving captain clears the captain. */
async function endMembership(
  tx: Tx,
  team: LockedTeam,
  userId: string,
  endReason: "LEFT" | "SWITCHED",
  now: Date,
): Promise<boolean> {
  const member = await tx.teamMember.findFirst({
    where: { teamId: team.id, userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!member) throw new NotAMemberError();
  await tx.teamMember.update({
    where: { id: member.id },
    data: { status: "LEFT", endReason, endedAt: now },
  });
  const captainCleared = team.captainUserId === userId;
  if (captainCleared) {
    await tx.team.update({ where: { id: team.id }, data: { captainUserId: null } });
  }
  return captainCleared;
}

/**
 * The player leaves their team before the season starts (S-38 AC 2, FR-34): the membership
 * ends (`LEFT`, `endReason LEFT`) and the player stays in the tournament without a team, free to
 * join a team with room later. A leaving captain leaves the team without a captain until the
 * organizer appoints one (AC 4). Lock order as an upload: the player's `swims:` lock, then the
 * team row. Throws NotFoundError, NotAMemberError and SeasonStartedError.
 */
export async function leaveTeam(
  userId: string,
  teamId: string,
  now: Date = new Date(),
): Promise<LeaveSwitchResult> {
  if (!isId(teamId)) throw new NotFoundError();
  if (!isId(userId)) throw new NotAMemberError();

  return db.$transaction(async (tx) => {
    await lockPlayerSwims(tx, userId);
    const [team] = await lockTeams(tx, [teamId]);
    if (!team) throw new NotFoundError();
    const { tournamentId } = team;
    await assertBeforeStart(tx, tournamentId, now);

    const captainCleared = await endMembership(tx, team, userId, "LEFT", now);
    await emitEvent(tx, {
      type: "TEAM_MEMBER_LEFT",
      payload: { tournamentId, teamId, userId },
    });
    return { tournamentId, captainCleared };
  });
}

/**
 * The player switches to another team of the same tournament with room before the season
 * starts, in one step (S-38 AC 1, AC 5, FR-34): one transaction takes the player's `swims:`
 * lock, locks both team rows in ascending id order, checks room (`TEAM_FULL`), ends the old
 * membership (`LEFT`, `endReason SWITCHED`) and creates the new active one, so the player is
 * always in exactly one team; concurrent switches into the last place serialize on the target
 * row. A switching captain leaves the old team without a captain (AC 4). Emits
 * `TEAM_MEMBER_LEFT` for the old team and `TEAM_JOINED` for the new one. Nothing has been swum
 * before the start, so no points or results move. Throws NotFoundError, InvalidMoveError,
 * NotAMemberError, SeasonStartedError, TeamFullError and MembershipConflictError.
 */
export async function switchTeam(
  userId: string,
  fromTeamId: string,
  toTeamId: string,
  now: Date = new Date(),
): Promise<LeaveSwitchResult & { membershipId: string }> {
  if (!isId(fromTeamId) || !isId(toTeamId)) throw new NotFoundError();
  if (fromTeamId === toTeamId) throw new InvalidMoveError();
  if (!isId(userId)) throw new NotAMemberError();

  try {
    return await db.$transaction(async (tx) => {
      await lockPlayerSwims(tx, userId);
      const teams = await lockTeams(tx, [fromTeamId, toTeamId]);
      const old = teams.find((t) => t.id === fromTeamId);
      const target = teams.find((t) => t.id === toTeamId);
      if (!old || !target || target.tournamentId !== old.tournamentId) throw new NotFoundError();
      const { tournamentId } = old;
      await assertBeforeStart(tx, tournamentId, now);

      const members = await tx.teamMember.count({ where: { teamId: toTeamId, status: "ACTIVE" } });
      if (members >= target.memberLimit) throw new TeamFullError();
      const captainCleared = await endMembership(tx, old, userId, "SWITCHED", now);
      const joined = await tx.teamMember.create({
        data: { teamId: toTeamId, tournamentId, userId, joinedAt: now },
      });

      await emitEvent(tx, {
        type: "TEAM_MEMBER_LEFT",
        payload: { tournamentId, teamId: fromTeamId, userId },
      });
      await emitEvent(tx, {
        type: "TEAM_JOINED",
        payload: { tournamentId, teamId: toTeamId, userId },
      });
      return { tournamentId, captainCleared, membershipId: joined.id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new MembershipConflictError();
    throw err;
  }
}
