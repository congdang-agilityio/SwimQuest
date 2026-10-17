import { activeDays } from "@/lib/scoring/weekly-multiplier";
import { vnWeekRange, vnWeekStart } from "@/lib/time/vn";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { awardBadge } from "./award";

const MINUTE_MS = 60_000;

/**
 * Mondays (Vietnam time) of the full Monday 00:00 to Sunday 23:59 weeks that lie entirely inside
 * the season; partial first and last weeks are left out. A season end at Sunday 23:59 still
 * contains that week (the week's last minute starts at 23:59).
 */
export function fullSeasonWeeks(t: { seasonStartAt: Date; seasonEndAt: Date }): string[] {
  const weeks: string[] = [];
  for (let week = vnWeekStart(t.seasonStartAt); ; week = vnWeekStart(vnWeekRange(week).end)) {
    const { start, end } = vnWeekRange(week);
    if (end.getTime() - MINUTE_MS > t.seasonEndAt.getTime()) return weeks;
    if (start >= t.seasonStartAt) weeks.push(week);
  }
}

/**
 * Season end (S-50 AC 1-2, FR-51): every player with at least one active day (VERIFIED swims)
 * in every full week of the season gets the Season badge, with the team of their latest
 * membership. Runs once per tournament: `seasonEndProcessedAt` is claimed first in the same
 * transaction, so a repeated or concurrent run does nothing; `SEASON_ENDED` is emitted once.
 * A season without a full week awards nothing. Late uploads accepted after this run are not
 * re-evaluated. Draft and archived tournaments are skipped. Returns the number of badges awarded, or null when already processed.
 */
export async function processSeasonEnd(tournamentId: string, now: Date): Promise<number | null> {
  return db.$transaction(async (tx) => {
    const claimed = await tx.tournament.updateMany({
      where: {
        id: tournamentId,
        status: { in: ["PUBLISHED", "ACTIVE", "COMPLETED"] },
        seasonEndProcessedAt: null,
        seasonEndAt: { lte: now },
      },
      data: { seasonEndProcessedAt: now },
    });
    if (claimed.count === 0) return null;
    const t = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { seasonStartAt: true, seasonEndAt: true },
    });

    let awarded = 0;
    const weeks = fullSeasonWeeks(t);
    if (weeks.length > 0) {
      const from = vnWeekRange(weeks[0]).start;
      const to = vnWeekRange(weeks[weeks.length - 1]).end;
      const results = await tx.swimResult.findMany({
        where: { tournamentId, status: "VERIFIED", swim: { startedAt: { gte: from, lt: to } } },
        select: { userId: true, swim: { select: { startedAt: true, distanceM: true } } },
      });
      const byUser = new Map<string, Map<string, { startedAt: Date; distanceM: number }[]>>();
      for (const { userId, swim } of results) {
        const perWeek = byUser.get(userId) ?? new Map();
        const week = vnWeekStart(swim.startedAt);
        perWeek.set(week, [...(perWeek.get(week) ?? []), swim]);
        byUser.set(userId, perWeek);
      }
      const winners = [...byUser.entries()]
        .filter(([, perWeek]) => weeks.every((w) => activeDays(perWeek.get(w) ?? []) >= 1))
        .map(([userId]) => userId)
        .sort();
      for (const userId of winners) {
        const member = await tx.teamMember.findFirst({
          where: { tournamentId, userId },
          orderBy: { joinedAt: "desc" },
          select: { teamId: true },
        });
        const teamId = member?.teamId ?? null;
        if (await awardBadge(tx, { tournamentId, userId, teamId, kind: "SEASON" })) awarded += 1;
      }
    }
    await emitEvent(tx, { type: "SEASON_ENDED", payload: { tournamentId } });
    return awarded;
  });
}
