import { emitEvent } from "@/server/events/emit";
import type { StartSetBy } from "@prisma/client";
import { getRoute, startDestinations } from "@/lib/routes";
import { isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { ForbiddenError, NotFoundError, requireCaptain } from "@/server/auth/roles";
import { db } from "@/server/db";

/** The slug is not one of the start destinations of the team's route (e.g. the finish). */
export class InvalidStartError extends Error {
  readonly status = 422;
  readonly code = "INVALID_START";
}

/** A different start after the start-choice deadline (story S-10, FR-39); `lockedAt` is when it locked. */
export class StartLockedError extends Error {
  readonly status = 409;
  readonly code = "START_LOCKED";
  constructor(readonly lockedAt: Date) {
    super("START_LOCKED");
  }
}

export type TeamStart = { slug: string | null; setAt: Date | null; setBy: StartSetBy | null };
export type ChooseStartResult = { changed: boolean; start: TeamStart };

type LockedTeam = {
  captainUserId: string | null;
  startDestination: string | null;
  startSetAt: Date | null;
  startSetBy: StartSetBy | null;
};

const toStart = (t: Omit<LockedTeam, "captainUserId">): TeamStart => ({
  slug: t.startDestination,
  setAt: t.startSetAt,
  setBy: t.startSetBy,
});

/** The team's chosen start, or `slug: null` when none is set yet. */
export async function getTeamStart(teamId: string): Promise<TeamStart> {
  const team =
    typeof teamId === "string" &&
    teamId.length > 0 &&
    (await db.team.findUnique({
      where: { id: teamId },
      select: { startDestination: true, startSetAt: true, startSetBy: true },
    }));
  if (!team) throw new NotFoundError();
  return toStart(team);
}

/**
 * The captain chooses or changes the team's start (story S-09, FR-38/FR-39). The start only
 * changes scenery and path, never the distance (BR-17). Throws the role errors of
 * `requireCaptain` and `InvalidStartError` for the finish or an unknown slug. The team row is
 * locked for the read and write, so concurrent choices are applied one after the other; the
 * same slug as now writes nothing and returns `changed: false`. From the start-choice deadline
 * (`now`, the server clock) any other slug throws `StartLockedError` and nothing is written.
 */
export async function chooseStart(
  userId: string,
  teamId: string,
  slug: unknown,
  now: Date = new Date(),
): Promise<ChooseStartResult> {
  const team = await requireCaptain(userId, teamId);
  const tournament = await db.tournament.findUniqueOrThrow({
    where: { id: team.tournamentId },
    select: { routeId: true },
  });
  const route = getRoute(tournament.routeId);
  const valid = route ? startDestinations(route).map((d) => d.slug) : [];
  if (typeof slug !== "string" || !valid.includes(slug)) throw new InvalidStartError();

  return db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<LockedTeam[]>`
      SELECT "captainUserId", "startDestination", "startSetAt", "startSetBy"
      FROM "Team" WHERE "id" = ${team.id} FOR UPDATE`;
    if (!locked) throw new NotFoundError();
    // The captain may have changed between the guard and the lock.
    if (locked.captainUserId !== userId) throw new ForbiddenError();
    if (locked.startDestination === slug) return { changed: false, start: toStart(locked) };
    const lifecycle = await tx.tournament.findUniqueOrThrow({
      where: { id: team.tournamentId },
      select: { status: true, seasonStartAt: true, seasonEndAt: true, startChoiceDeadlineAt: true },
    });
    if (isStartLocked(lifecycle, now)) throw new StartLockedError(startLockAt(lifecycle));

    const updated = await tx.team.update({
      where: { id: team.id },
      data: { startDestination: slug, startSetAt: new Date(), startSetBy: "CAPTAIN" },
      select: { startDestination: true, startSetAt: true, startSetBy: true },
    });
    await emitEvent(tx, {
      type: "TEAM_START_SET",
      payload: { tournamentId: team.tournamentId, teamId: team.id, startId: slug, setBy: userId },
    });
    return { changed: true, start: toStart(updated) };
  });
}
