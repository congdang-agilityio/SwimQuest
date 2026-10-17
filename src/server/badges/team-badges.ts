import type { EventHandler, EventTx } from "@/server/events/handlers";
import type { DomainEventType } from "@/server/events/types";
import { awardBadge, removeBadge } from "./award";

/** Route progress (basis points) whose crossing earns Explorer (S-49 AC 1). */
export const EXPLORER_BP = 5000;
/** Removal reason for Lý Sơn badges when the team's finish is withdrawn (S-49 AC 4, S-47). */
export const FINISH_WITHDRAWN = "FINISH_WITHDRAWN";
/** Removal reason for the old team's Lý Sơn badge when its holder is moved (S-49 AC 5). */
export const MOVED_TEAM = "MOVED_TEAM";

const activeMemberIds = async (tx: EventTx, teamId: string): Promise<string[]> =>
  (
    await tx.teamMember.findMany({
      where: { teamId, status: "ACTIVE" },
      select: { userId: true },
      orderBy: { userId: "asc" },
    })
  ).map((m) => m.userId);

/**
 * Team badges (S-49, FR-51), run inside the progress transaction:
 * - EXPLORER to every active member when progress crosses 50%; once per player and tournament,
 *   so a drop and re-cross (or a player who already earned it with another team) gets nothing new;
 * - LY_SON (with `teamId`) to every active member when the finish is recorded, and removed from
 *   holders of that team's Lý Sơn when the finish is withdrawn; a re-finish awards it again;
 * - a moved player loses the Lý Sơn earned with the old team; Explorer and Teamwork stay.
 */
export const teamBadgeHandlers: { [T in DomainEventType]?: EventHandler<T> } = {
  TEAM_PROGRESS_CHANGED: async (tx, p) => {
    if (p.fromBp >= EXPLORER_BP || p.toBp < EXPLORER_BP) return;
    const { tournamentId, teamId } = p;
    for (const userId of await activeMemberIds(tx, teamId)) {
      const earned = await tx.badge.findFirst({
        where: { tournamentId, userId, kind: "EXPLORER" },
        select: { id: true },
      });
      if (!earned) await awardBadge(tx, { tournamentId, userId, teamId, kind: "EXPLORER" });
    }
  },
  TEAM_FINISHED: async (tx, p) => {
    const { tournamentId, teamId } = p;
    for (const userId of await activeMemberIds(tx, teamId)) {
      await awardBadge(tx, { tournamentId, userId, teamId, kind: "LY_SON" });
    }
  },
  TEAM_FINISH_LOST: async (tx, p) => {
    const { tournamentId, teamId } = p;
    const holders = await tx.badge.findMany({
      where: { tournamentId, teamId, kind: "LY_SON", removedAt: null },
      select: { userId: true },
      orderBy: { userId: "asc" },
    });
    for (const { userId } of holders) {
      await removeBadge(tx, { tournamentId, userId, kind: "LY_SON" }, FINISH_WITHDRAWN);
    }
  },
  TEAM_MEMBER_MOVED: async (tx, p) => {
    const { tournamentId, userId, fromTeamId } = p;
    const lySon = await tx.badge.findFirst({
      where: { tournamentId, userId, teamId: fromTeamId, kind: "LY_SON", removedAt: null },
      select: { id: true },
    });
    if (lySon) await removeBadge(tx, { tournamentId, userId, kind: "LY_SON" }, MOVED_TEAM);
  },
};
