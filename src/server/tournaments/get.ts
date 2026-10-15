import { db } from "@/server/db";

/**
 * Reads a tournament for a viewer (`null` when signed out). A draft is private to its
 * organizer (FR-21, story S-04 AC 5): anyone else gets `null`, exactly as for a missing id,
 * so the response does not reveal that the draft exists.
 */
export async function getTournamentForViewer(viewerId: string | null, id: string) {
  if (typeof id !== "string" || id.length === 0) return null;
  const tournament = await db.tournament.findUnique({ where: { id } });
  if (!tournament) return null;
  if (tournament.status === "DRAFT" && tournament.organizerId !== viewerId) return null;
  return tournament;
}
