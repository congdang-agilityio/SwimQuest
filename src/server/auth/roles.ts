import { db } from "@/server/db";
import { apiError } from "../http/api-error";

/** Role guards (FR-09). Roles come from the database, never from client input. */
export class ForbiddenError extends Error {
  readonly status = 403;
  readonly code = "FORBIDDEN";
}
export class NotFoundError extends Error {
  readonly status = 404;
  readonly code = "NOT_FOUND";
}
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export async function requireOrganizer(userId: string, tournamentId: string) {
  const t = isId(tournamentId) && (await db.tournament.findUnique({ where: { id: tournamentId } }));
  if (!t) throw new NotFoundError();
  if (t.organizerId !== userId) throw new ForbiddenError();
  return t;
}

/**
 * The tournament's organizer or a platform admin (S-32 AC 4). `user` is the signed-in user
 * (roles from the database). Throws NotFoundError for an unknown tournament, else ForbiddenError.
 */
export async function requireOrganizerOrAdmin(
  user: { id: string; isPlatformAdmin: boolean } | null,
  tournamentId: string,
) {
  const t = isId(tournamentId) && (await db.tournament.findUnique({ where: { id: tournamentId } }));
  if (!t) throw new NotFoundError();
  if (user?.isPlatformAdmin !== true && (!isId(user?.id) || t.organizerId !== user.id))
    throw new ForbiddenError();
  return t;
}

/**
 * Who may review a tournament's flagged swims and disputes (S-43, S-45, FR-71): its organizer
 * or an active review helper of that tournament who also still has an ACTIVE team membership in
 * it (a helper who left or was removed loses access). Read from the database on every call, so
 * a removed helper is refused on the next request. Helpers get no other organizer power (team
 * and tournament edits use `requireOrganizer`). Throws NotFoundError for an unknown
 * tournament, else ForbiddenError.
 */
export async function requireReviewer(userId: string, tournamentId: string) {
  const t = isId(tournamentId) && (await db.tournament.findUnique({ where: { id: tournamentId } }));
  if (!t) throw new NotFoundError();
  if (!isId(userId)) throw new ForbiddenError();
  if (t.organizerId === userId) return t;
  // One query: the active helper row, joined to an ACTIVE membership in the same tournament.
  const helper = await db.reviewHelper.count({
    where: {
      tournamentId,
      userId,
      removedAt: null,
      user: { memberships: { some: { tournamentId, status: "ACTIVE" } } },
    },
  });
  if (helper === 0) throw new ForbiddenError();
  return t;
}

export async function isOrganizer(userId: string, tournamentId: string): Promise<boolean> {
  if (!isId(userId) || !isId(tournamentId)) return false;
  return (await db.tournament.count({ where: { id: tournamentId, organizerId: userId } })) > 0;
}

export async function requireCaptain(userId: string, teamId: string) {
  const team = isId(teamId) && (await db.team.findUnique({ where: { id: teamId } }));
  if (!team) throw new NotFoundError();
  const where = { teamId, userId, status: "ACTIVE" as const };
  if (!isId(userId) || team.captainUserId !== userId || !(await db.teamMember.count({ where })))
    throw new ForbiddenError();
  return team;
}

export function requirePlatformAdmin(user: { isPlatformAdmin: boolean } | null): void {
  if (user?.isPlatformAdmin !== true) throw new ForbiddenError();
}

/** The 403/404 API response for a role error, or null for any other error (rethrow it). */
export function roleErrorResponse(err: unknown) {
  const known = err instanceof ForbiddenError || err instanceof NotFoundError;
  return known ? apiError(err.status, err.code) : null;
}
