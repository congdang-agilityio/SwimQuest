import type { SwimResult, Tournament } from "@prisma/client";
import { activeDays, extraPoints, weeklyMultiplierPct } from "@/lib/scoring/weekly-multiplier";
import { previousWeekStart, vnWeekRange, vnWeekStart } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { updateTeamProgress } from "@/server/progress/update-team-progress";
import { lockPlayerPoints } from "./award-distance-points";

/** Mondays (Vietnam time) of the weeks that overlap the season and have ended at `now`. */
export function endedSeasonWeeks(t: { seasonStartAt: Date; seasonEndAt: Date }, now: Date) {
  const weeks: string[] = [];
  for (let week = vnWeekStart(t.seasonStartAt); ; week = vnWeekStart(vnWeekRange(week).end)) {
    const { start, end } = vnWeekRange(week);
    if (start >= t.seasonEndAt || end > now) return weeks;
    weeks.push(week);
  }
}

/**
 * Recomputes a player's week (BR-30) from VERIFIED results and their DISTANCE points (no bonuses).
 * The week's WEEKLY_MULTIPLIER entries (vnDay = its Monday) add up to `WeeklyResult.extraPoints`:
 * a change is a new entry with the difference, for the player's team when the week ended.
 */
async function applyPlayerWeek(tx: Tx, t: Tournament, userId: string, week: string, now: Date) {
  const { start, end } = vnWeekRange(week);
  const ids = { tournamentId: t.id, userId };
  const results = await tx.swimResult.findMany({
    where: { ...ids, status: "VERIFIED", swim: { startedAt: { gte: start, lt: end } } },
    select: {
      teamId: true,
      swim: { select: { startedAt: true, distanceM: true } },
      pointsEntries: { where: { kind: "DISTANCE" }, select: { points: true } },
    },
    orderBy: { swim: { startedAt: "asc" } },
  });
  const rows = await tx.weeklyResult.findMany({
    where: { ...ids, weekStart: { in: [previousWeekStart(week), week] } },
  });
  const existing = rows.find((r) => r.weekStart === week);
  const streak = rows.find((r) => r.weekStart !== week)?.streakWeeks ?? 0;
  if (results.length === 0 && !existing) return null;
  const days = activeDays(results.map((r) => r.swim));
  const multiplierPct = weeklyMultiplierPct({
    activeDays: days,
    previousThreePlusStreak: streak,
    values: {
      multiplier2DaysPct: t.multiplierTwoDaysPct,
      multiplier3DaysPct: t.multiplierThreeDaysPct,
      multiplierStreakStepPct: t.streakStepPct,
      multiplierMaxPct: t.multiplierMaxPct,
    },
  });
  const distancePoints = results.reduce((sum, r) => sum + (r.pointsEntries[0]?.points ?? 0), 0);
  const extra = extraPoints(distancePoints, multiplierPct);
  const row = { activeDays: days, multiplierPct, distancePoints, extraPoints: extra };
  const data = { ...row, streakWeeks: days >= 3 ? streak + 1 : 0 };
  const member = await tx.teamMember.findFirst({
    where: { ...ids, joinedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gte: end } }] },
    orderBy: { joinedAt: "desc" },
  });
  const teamId = existing?.teamId ?? member?.teamId ?? results[results.length - 1].teamId;
  if (existing) await tx.weeklyResult.update({ where: { id: existing.id }, data });
  else
    await tx.weeklyResult.create({
      data: { ...ids, teamId, weekStart: week, settledAt: now, ...data },
    });
  const points = extra - (existing?.extraPoints ?? 0);
  if (points === 0) return null;
  await tx.pointsEntry.create({
    data: { ...ids, teamId, kind: "WEEKLY_MULTIPLIER", points, vnDay: week },
  });
  return teamId;
}

/** Applies the weeks in order; returns the teams that got points, ascending (lock order). */
async function applyWeeks(tx: Tx, t: Tournament, userId: string, weeks: string[], now: Date) {
  await lockPlayerPoints(tx, t.id, userId);
  const teams: string[] = [];
  for (const week of weeks) teams.push((await applyPlayerWeek(tx, t, userId, week, now)) ?? "");
  return [...new Set(teams.filter(Boolean))].sort();
}

/**
 * Settles a tournament's week (S-21) once, oldest week first: a repeated or concurrent call finds
 * the `WeekSettlement` claimed and returns false. Then refreshes the progress of changed teams.
 */
export async function settleWeek(tournamentId: string, week: string, now = new Date()) {
  const { start, end } = vnWeekRange(week);
  return db.$transaction(
    async (tx) => {
      const claim = await tx.weekSettlement.createMany({
        data: { tournamentId, weekStart: week, settledAt: now },
        skipDuplicates: true,
      });
      if (claim.count === 0) return false;
      const t = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
      const players = await tx.swimResult.findMany({
        where: { tournamentId, status: "VERIFIED", swim: { startedAt: { gte: start, lt: end } } },
        distinct: ["userId"],
        orderBy: { userId: "asc" },
      });
      const teams = new Set<string>();
      for (const { userId } of players) {
        for (const team of await applyWeeks(tx, t, userId, [week], now)) teams.add(team);
      }
      for (const team of [...teams].sort()) await updateTeamProgress(tx, tournamentId, team, now);
      return true;
    },
    { timeout: 60_000 },
  );
}

/**
 * Recomputes a player's settled week (S-46) and the later settled weeks (streaks). Returns the
 * teams whose points changed, ascending; the caller refreshes their progress in its lock order.
 */
export async function recalculatePlayerWeek(
  tx: Tx,
  tournamentId: string,
  userId: string,
  week: string,
  now = new Date(),
): Promise<string[]> {
  vnWeekRange(week);
  const settled = await tx.weekSettlement.findMany({
    where: { tournamentId, weekStart: { gte: week } },
    orderBy: { weekStart: "asc" },
  });
  if (settled[0]?.weekStart !== week) return [];
  const t = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const weeks = settled.map((s) => s.weekStart);
  return applyWeeks(tx, t, userId, weeks, now);
}

/**
 * Late verification: when a result's week (Vietnam time) is already settled, recomputes that
 * week and the later settled weeks for its player (BR-29, FR-78). No-op for an unsettled week.
 * Returns the teams whose points changed, ascending.
 */
export async function recalculateSettledWeek(tx: Tx, result: SwimResult, now = new Date()) {
  if (result.status !== "VERIFIED") return [];
  const { startedAt } = await tx.swim.findUniqueOrThrow({ where: { id: result.swimId } });
  const week = vnWeekStart(startedAt);
  return recalculatePlayerWeek(tx, result.tournamentId, result.userId, week, now);
}
