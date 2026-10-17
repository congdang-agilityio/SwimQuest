import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { toPublicPlayer, type PublicPlayer } from "@/server/users/public-player";

/** A tournament player without an active team, as the organizer's list shows them (S-42). */
export type UnassignedPlayer = PublicPlayer & {
  /** Their latest membership ended with a removal after the start (S-41): link join blocked. */
  removedAfterStart: boolean;
  /** When their latest membership ended. */
  endedAt: Date | null;
};

type Row = { id: string; displayName: string; endReason: string | null; endedAt: Date | null };

/**
 * "Players without a team" (story S-42, AC 1, FR-75): every player with at least one membership
 * in the tournament and no active one, including players removed after the start. Ordered by
 * the most recently ended membership first. Public fields only (NFR-05). Throws NotFoundError
 * (unknown tournament) or ForbiddenError (not its organizer).
 */
export async function listUnassignedPlayers(
  organizerId: string,
  tournamentId: string,
): Promise<UnassignedPlayer[]> {
  await requireOrganizer(organizerId, tournamentId);
  const rows = await db.$queryRaw<Row[]>`
    SELECT u."id", u."displayName", l."endReason", l."endedAt"
    FROM (
      SELECT DISTINCT ON (m."userId") m."userId", m."endReason"::text, m."endedAt"
      FROM "TeamMember" m
      WHERE m."tournamentId" = ${tournamentId}
      ORDER BY m."userId", m."joinedAt" DESC, m."id" DESC
    ) l
    JOIN "User" u ON u."id" = l."userId"
    WHERE NOT EXISTS (
      SELECT 1 FROM "TeamMember" a
      WHERE a."tournamentId" = ${tournamentId} AND a."userId" = l."userId" AND a."status" = 'ACTIVE'
    )
    ORDER BY l."endedAt" DESC NULLS LAST, u."displayName", u."id"`;
  return rows.map((r) => ({
    ...toPublicPlayer(r),
    removedAfterStart: r.endReason === "REMOVED_AFTER_START",
    endedAt: r.endedAt,
  }));
}
