import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";

export type SeasonStartCounts = { tournaments: number; failed: number };

/**
 * Emits `SEASON_STARTED` once per tournament when its season starts (S-86 AC 4). Considers
 * published tournaments (PUBLISHED/ACTIVE) whose season has started but not yet ended and whose
 * `seasonStartProcessedAt` is null. Each one is claimed with a conditional update, which locks
 * the row, and the event is emitted in the same transaction, so repeated or concurrent ticks
 * emit it once. Drafts, archived and completed tournaments are skipped. A failing tournament is
 * logged and retried on the next tick.
 */
export async function processSeasonStarts(now: Date): Promise<SeasonStartCounts> {
  const where = {
    status: { in: ["PUBLISHED" as const, "ACTIVE" as const] },
    seasonStartAt: { lte: now },
    seasonEndAt: { gt: now },
    seasonStartProcessedAt: null,
  };
  const due = await db.tournament.findMany({
    where,
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const counts: SeasonStartCounts = { tournaments: 0, failed: 0 };
  for (const { id } of due) {
    try {
      const emitted = await db.$transaction(async (tx) => {
        const claimed = await tx.tournament.updateMany({
          where: { id, ...where },
          data: { seasonStartProcessedAt: now },
        });
        if (claimed.count === 0) return false;
        await emitEvent(tx, { type: "SEASON_STARTED", payload: { tournamentId: id } });
        return true;
      });
      if (emitted) counts.tournaments += 1;
    } catch (error) {
      counts.failed += 1;
      console.error(`tick: season start failed for tournament ${id}`, error);
    }
  }
  return counts;
}
