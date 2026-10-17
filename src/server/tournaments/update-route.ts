import { isRouteEditable } from "@/lib/tournaments/lifecycle";
import { tournamentDraftFieldsSchema } from "@/lib/validation/tournament";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";

const ROUTE_FIELDS = ["routeId", "routeDistanceKm"];
const routeChangeSchema = tournamentDraftFieldsSchema
  .pick({ routeId: true, routeDistanceKm: true })
  .partial();

export type UpdateRouteResult =
  | { ok: true; tournament: { id: string; routeId: string; routeDistanceM: number } }
  | { ok: false; reason: "ROUTE_LOCKED" }
  | { ok: false; reason: "INVALID"; errors: Record<string, string> };

/**
 * Changes the route and/or route distance (story S-10 AC 4). Organizer only (throws the role
 * errors of `requireOrganizer`); refused with ROUTE_LOCKED from the season start. The write is
 * conditional on the stored season start, so a concurrent change of it cannot slip through.
 */
export async function updateRoute(
  userId: string,
  id: string,
  input: unknown,
  now: Date,
): Promise<UpdateRouteResult> {
  const tournament = await requireOrganizer(userId, id, { write: true });
  if (!isRouteEditable(tournament, now)) return { ok: false, reason: "ROUTE_LOCKED" };

  const isObject = typeof input === "object" && input !== null && !Array.isArray(input);
  const keys = isObject ? Object.keys(input) : [];
  const unknown = keys.filter((key) => !ROUTE_FIELDS.includes(key));
  if (unknown.length > 0) {
    const errors = Object.fromEntries(unknown.map((key) => [key, "UNKNOWN_FIELD"]));
    return { ok: false, reason: "INVALID", errors };
  }
  if (keys.length === 0)
    return { ok: false, reason: "INVALID", errors: { body: "NO_ROUTE_CHANGE" } };

  const parsed = routeChangeSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, reason: "INVALID", errors };
  }

  const routeId = parsed.data.routeId ?? tournament.routeId;
  const routeDistanceM = parsed.data.routeDistanceKm ?? tournament.routeDistanceM;
  const { count } = await db.tournament.updateMany({
    where: { id: tournament.id, seasonStartAt: { gt: now } },
    data: { routeId, routeDistanceM },
  });
  if (count === 0) return { ok: false, reason: "ROUTE_LOCKED" };
  return { ok: true, tournament: { id: tournament.id, routeId, routeDistanceM } };
}
