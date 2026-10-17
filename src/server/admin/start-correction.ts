import { z } from "zod";
import type { StartSetBy } from "@prisma/client";
import { getRoute, startDestinations } from "@/lib/routes";
import { isStartLocked } from "@/lib/tournaments/lifecycle";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { ArchivedError, NotFoundError, requirePlatformAdmin } from "@/server/auth/roles";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { ReasonRequiredError } from "@/server/review/decide";
import { InvalidStartError } from "@/server/starts/choose-start";
import type { AdminActor } from "./users";

/** The start is not locked yet: the organizer or captain changes it the normal way. */
export class StartNotLockedError extends Error {
  readonly status = 409;
  readonly code = "START_NOT_LOCKED";
}

export type StartCorrection = { changed: boolean; destination: string | null };

const reasonSchema = z.string().trim().min(1).max(300);

type LockedTeam = {
  tournamentId: string;
  startDestination: string | null;
  startSetBy: StartSetBy | null;
};

/**
 * A platform admin changes a team's locked start as an exceptional correction (S-72 AC 3,
 * FR-55): reason required (1-300 characters after trimming), one of the route's starts (never
 * the finish). Only after the start lock and never in an ARCHIVED tournament. The team row is
 * locked; `startSetBy` and `startSetAt` are kept (only the destination changes), so progress and
 * points are untouched and the ship position follows the new path. Audited as
 * `START_CORRECTED_BY_ADMIN` with the old and new start and the reason, and emits
 * `TEAM_START_SET`. The same start as now writes nothing. Throws ForbiddenError,
 * NotFoundError, ArchivedError, ReasonRequiredError, InvalidStartError, StartNotLockedError.
 */
export async function correctStart(
  admin: AdminActor,
  teamId: string,
  slug: unknown,
  reason: unknown,
  now: Date = new Date(),
): Promise<StartCorrection> {
  const adminId = typeof admin?.id === "string" ? admin.id : "";
  const user = adminId ? await db.user.findUnique({ where: { id: adminId } }) : null;
  requirePlatformAdmin(user?.status === "ACTIVE" ? user : null);
  const note = reasonSchema.safeParse(reason);
  if (!note.success) throw new ReasonRequiredError();
  if (typeof teamId !== "string" || teamId.length === 0) throw new NotFoundError();

  return db.$transaction(async (tx) => {
    const [team] = await tx.$queryRaw<LockedTeam[]>`
      SELECT "tournamentId", "startDestination", "startSetBy"
      FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
    if (!team) throw new NotFoundError();
    const tournament = await tx.tournament.findUniqueOrThrow({ where: { id: team.tournamentId } });
    if (tournament.status === "ARCHIVED") throw new ArchivedError();
    const route = getRoute(tournament.routeId);
    const valid = route ? startDestinations(route).map((d) => d.slug) : [];
    if (typeof slug !== "string" || !valid.includes(slug)) throw new InvalidStartError();
    if (!isStartLocked(tournament, now)) throw new StartNotLockedError();
    if (team.startDestination === slug) return { changed: false, destination: slug };

    await tx.team.update({ where: { id: teamId }, data: { startDestination: slug } });
    const ids = { teamId, tournamentId: team.tournamentId };
    await recordAudit(tx, {
      actor: { type: "USER", userId: adminId },
      action: AUDIT_ACTIONS.START_CORRECTED_BY_ADMIN,
      entityType: "Team",
      entityId: teamId,
      tournamentId: team.tournamentId,
      before: { ...ids, startDestination: team.startDestination, startSetBy: team.startSetBy },
      after: { ...ids, startDestination: slug, startSetBy: team.startSetBy },
      reason: note.data,
    });
    await emitEvent(tx, {
      type: "TEAM_START_SET",
      payload: { ...ids, startId: slug, setBy: adminId },
    });
    return { changed: true, destination: slug };
  });
}
