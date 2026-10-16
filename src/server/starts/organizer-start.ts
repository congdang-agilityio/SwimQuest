import type { StartSetBy } from "@prisma/client";
import { getRoute, startDestinations } from "@/lib/routes";
import { isStartLocked, startLockAt } from "@/lib/tournaments/lifecycle";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { type ChooseStartResult, InvalidStartError, StartLockedError } from "./choose-start";

type LockedTeam = {
  startDestination: string | null;
  startSetAt: Date | null;
  startSetBy: StartSetBy | null;
};

/**
 * The organizer sets or replaces a team's start before the lock (story S-37, FR-38/FR-55):
 * a captain's choice is overridden. Throws the role errors of `requireOrganizer`,
 * `InvalidStartError` for the finish or an unknown slug, and `StartLockedError` from the
 * start-choice deadline (`now`, the server clock), also when the start was assigned
 * automatically. The team row is locked for the read and write; the same slug as now writes
 * nothing. A change is audited with the old and new start and emits `TEAM_START_SET`; the team
 * then has a start, so automatic assignment skips it.
 */
export async function organizerSetStart(
  userId: string,
  teamId: string,
  slug: unknown,
  now: Date = new Date(),
): Promise<ChooseStartResult> {
  const team =
    typeof teamId === "string" &&
    teamId.length > 0 &&
    (await db.team.findUnique({ where: { id: teamId }, select: { tournamentId: true } }));
  if (!team) throw new NotFoundError();
  const tournament = await requireOrganizer(userId, team.tournamentId);
  const route = getRoute(tournament.routeId);
  const valid = route ? startDestinations(route).map((d) => d.slug) : [];
  if (typeof slug !== "string" || !valid.includes(slug)) throw new InvalidStartError();

  return db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<LockedTeam[]>`
      SELECT "startDestination", "startSetAt", "startSetBy"
      FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
    if (!locked) throw new NotFoundError();
    const lifecycle = await tx.tournament.findUniqueOrThrow({
      where: { id: team.tournamentId },
      select: { status: true, seasonStartAt: true, seasonEndAt: true, startChoiceDeadlineAt: true },
    });
    if (isStartLocked(lifecycle, now)) throw new StartLockedError(startLockAt(lifecycle));
    const current = { slug: locked.startDestination, setAt: locked.startSetAt };
    if (locked.startDestination === slug) {
      return { changed: false, start: { ...current, setBy: locked.startSetBy } };
    }

    await tx.team.update({
      where: { id: teamId },
      data: { startDestination: slug, startSetAt: now, startSetBy: "ORGANIZER" },
    });
    const ids = { teamId, tournamentId: team.tournamentId };
    await recordAudit(tx, {
      actor: { type: "USER", userId },
      action: AUDIT_ACTIONS.TEAM_START_SET_BY_ORGANIZER,
      entityType: "Team",
      entityId: teamId,
      tournamentId: team.tournamentId,
      before: { ...ids, startDestination: locked.startDestination, startSetBy: locked.startSetBy },
      after: {
        ...ids,
        startDestination: slug,
        startSetAt: now.toISOString(),
        startSetBy: "ORGANIZER",
      },
    });
    await emitEvent(tx, {
      type: "TEAM_START_SET",
      payload: { ...ids, startId: slug, setBy: userId },
    });
    return { changed: true, start: { slug, setAt: now, setBy: "ORGANIZER" as const } };
  });
}
