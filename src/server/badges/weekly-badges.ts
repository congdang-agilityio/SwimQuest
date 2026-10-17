import { previousWeekStart } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";
import { awardBadge } from "./award";

/** Consecutive weeks with enough active days that earn Perseverance (S-50 AC 3). */
export const PERSEVERANCE_WEEKS = 4;
/** Active days a week needs to count towards Perseverance. */
export const PERSEVERANCE_MIN_DAYS = 3;

/**
 * Weekly badge checks, run inside the settlement transaction after the week's `WeeklyResult`
 * rows are written. Perseverance goes to a player with 3+ active days in each of the
 * 4 weeks ending with `weekStart`; `awardBadge` keeps it to one per tournament.
 */
export async function onWeekSettled(
  tx: Tx,
  tournamentId: string,
  weekStart: string,
): Promise<void> {
  const weeks = [weekStart];
  while (weeks.length < PERSEVERANCE_WEEKS) weeks.push(previousWeekStart(weeks[weeks.length - 1]));

  const rows = await tx.weeklyResult.findMany({
    where: {
      tournamentId,
      weekStart: { in: weeks },
      activeDays: { gte: PERSEVERANCE_MIN_DAYS },
    },
    select: { userId: true, teamId: true, weekStart: true },
    orderBy: { userId: "asc" },
  });
  const byUser = new Map<string, { teamId: string; weeks: Set<string> }>();
  for (const r of rows) {
    const entry = byUser.get(r.userId) ?? { teamId: r.teamId, weeks: new Set<string>() };
    if (r.weekStart === weekStart) entry.teamId = r.teamId;
    entry.weeks.add(r.weekStart);
    byUser.set(r.userId, entry);
  }
  for (const [userId, { teamId, weeks: have }] of byUser) {
    if (have.size < PERSEVERANCE_WEEKS || !have.has(weekStart)) continue;
    await awardBadge(tx, { tournamentId, userId, teamId, kind: "PERSEVERANCE" });
  }
}
