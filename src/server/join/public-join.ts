import { effectiveStatus } from "@/lib/tournaments/lifecycle";
import { db } from "@/server/db";
import { JoinError, runJoin, type JoinResult } from "./join-team";
import { buildJoinView, type JoinView } from "./join-view";

/**
 * What `/tournaments/:id/join` shows (story S-30 AC 3): the same view as an invite link, for a
 * public tournament that is published, active or completed (joining open only while published
 * or active, BR-33). Drafts, archived, invite-only and unset-visibility tournaments return null,
 * exactly like a missing id, so the response never reveals that they exist. The invite link
 * switch does not affect it.
 */
export async function getPublicJoinView(
  userId: string,
  tournamentId: unknown,
  now: Date = new Date(),
): Promise<JoinView | null> {
  if (typeof tournamentId !== "string" || tournamentId.length === 0) return null;
  const t = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!t || t.visibility !== "PUBLIC" || t.archivedAt) return null;
  const status = effectiveStatus(t, now);
  if (status === "DRAFT" || status === "ARCHIVED") return null;
  return buildJoinView(userId, t, true, now);
}

/**
 * Joins the chosen team of a public tournament at once, with no approval (S-30 AC 3/AC 4), under
 * the same rules as the invite link (`joinTeamInTournament`: capacity lock, one active team,
 * joining open, removed-after-start refused). Visibility is read under the join lock: an
 * invite-only (or unset) tournament is refused with `NOT_PUBLIC`. The invite link switch does
 * not matter here.
 */
export async function joinPublic(
  userId: string,
  tournamentId: unknown,
  teamId: unknown,
  now: Date = new Date(),
): Promise<JoinResult> {
  if (
    typeof tournamentId !== "string" ||
    tournamentId.length === 0 ||
    typeof teamId !== "string" ||
    teamId.length === 0
  ) {
    throw new JoinError("NOT_FOUND");
  }
  return runJoin(userId, tournamentId, teamId, now, (locked) => {
    if (locked.visibility !== "PUBLIC") throw new JoinError("NOT_PUBLIC");
    if (locked.status === "DRAFT") throw new JoinError("NOT_FOUND");
  });
}
