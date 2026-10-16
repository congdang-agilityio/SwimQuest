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
 * Who may review a tournament's flagged swims (S-43): its organizer for now; review helpers
 * (S-45) extend this. Throws NotFoundError for an unknown tournament, else ForbiddenError.
 */
export async function requireReviewer(userId: string, tournamentId: string) {
  return requireOrganizer(userId, tournamentId);
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
