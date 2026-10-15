import type { StartSetBy } from "@prisma/client";
import { getRoute, startDestinations } from "@/lib/routes";
import { ForbiddenError, NotFoundError, requireCaptain } from "@/server/auth/roles";
import { db } from "@/server/db";

/** The slug is not one of the start destinations of the team's route (e.g. the finish). */
export class InvalidStartError extends Error {
  readonly status = 422;
  readonly code = "INVALID_START";
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
 * same slug as now writes nothing and returns `changed: false`.
 */
export async function chooseStart(
  userId: string,
  teamId: string,
  slug: unknown,
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

    const updated = await tx.team.update({
      where: { id: team.id },
      data: { startDestination: slug, startSetAt: new Date(), startSetBy: "CAPTAIN" },
      select: { startDestination: true, startSetAt: true, startSetBy: true },
    });
    return { changed: true, start: toStart(updated) };
  });
}
