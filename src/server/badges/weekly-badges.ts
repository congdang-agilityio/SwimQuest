import { previousWeekStart, vnWeekRange } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";
import { awardBadge } from "./award";

/** Consecutive weeks with enough active days that earn Perseverance (S-50 AC 3). */
export const PERSEVERANCE_WEEKS = 4;
/** Active days a week needs to count towards Perseverance. */
export const PERSEVERANCE_MIN_DAYS = 3;

/**
 * Teamwork (S-49 AC 2): every member of a team gets it when every member had at least one active
 * day in the week. Members are the team's members when the week ended (Vietnam time); one member
 * without an active day blocks the whole team. Given at most once per player and tournament, so a
 * player who earned it before (with any team) gets nothing new. Awards go in `userId` order.
 */
async function awardTeamwork(tx: Tx, tournamentId: string, weekStart: string): Promise<void> {
  const { end } = vnWeekRange(weekStart);
  const members = await tx.teamMember.findMany({
    where: {
      tournamentId,
      joinedAt: { lt: end },
      OR: [{ endedAt: null }, { endedAt: { gte: end } }],
    },
    select: { teamId: true, userId: true },
  });
  const active = new Set(
    (
      await tx.weeklyResult.findMany({
        where: { tournamentId, weekStart, activeDays: { gte: 1 } },
        select: { userId: true },
      })
    ).map((r) => r.userId),
  );
  const blocked = new Set(members.filter((m) => !active.has(m.userId)).map((m) => m.teamId));
  const winners = members.filter((m) => !blocked.has(m.teamId));
  if (winners.length === 0) return;

  const earned = new Set(
    (
      await tx.badge.findMany({
        where: { tournamentId, kind: "TEAMWORK", userId: { in: winners.map((m) => m.userId) } },
        select: { userId: true },
      })
    ).map((b) => b.userId),
  );
  winners.sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
  for (const { userId, teamId } of winners) {
    if (earned.has(userId)) continue;
    await awardBadge(tx, { tournamentId, userId, teamId, kind: "TEAMWORK" });
  }
}

/**
 * Weekly badge checks, run inside the settlement transaction after the week's `WeeklyResult`
 * rows are written. Perseverance goes to a player with 3+ active days in each of the
 * 4 weeks ending with `weekStart`; `awardBadge` keeps it to one per tournament. Teamwork goes to
 * every member of a team whose members all had an active day that week.
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
  await awardTeamwork(tx, tournamentId, weekStart);
}
