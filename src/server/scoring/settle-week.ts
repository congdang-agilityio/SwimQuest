import { activeDays, extraPoints, weeklyMultiplierPct } from "@/lib/scoring/weekly-multiplier";
import { previousWeekStart, vnDayKey, vnWeekRange, vnWeekStart } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { updateTeamProgress } from "@/server/progress/update-team-progress";
import { lockPlayerPoints } from "./award-distance-points";

const SETTINGS = {
  longestSwimCountedM: true,
  multiplierTwoDaysPct: true,
  multiplierThreeDaysPct: true,
  streakStepPct: true,
  multiplierMaxPct: true,
} as const;
type Settings = Awaited<ReturnType<typeof settingsOf>>;
const settingsOf = (tx: Tx, id: string) =>
  tx.tournament.findUniqueOrThrow({ where: { id }, select: SETTINGS });

/** Mondays of the weeks that overlap the season and have fully ended at `now`, oldest first. */
export function endedSeasonWeeks(
  t: { seasonStartAt: Date; seasonEndAt: Date },
  now: Date,
): string[] {
  const weeks: string[] = [];
  for (let week = vnWeekStart(t.seasonStartAt); ;) {
    const { start, end } = vnWeekRange(week);
    if (start >= t.seasonEndAt || end > now) return weeks;
    weeks.push(week);
    week = vnWeekStart(end);
  }
}

/** The team the player was in when the week ended (left after it, or still in it), if any. */
async function teamAtWeekEnd(tx: Tx, tournamentId: string, userId: string, end: Date) {
  const member = await tx.teamMember.findFirst({
    where: {
      tournamentId,
      userId,
      joinedAt: { lt: end },
      OR: [{ endedAt: null }, { endedAt: { gte: end } }],
    },
    orderBy: { joinedAt: "desc" },
    select: { teamId: true },
  });
  return member?.teamId;
}

/**
 * Computes one player's week from the ledger and writes the change: the WEEKLY_MULTIPLIER
 * entries of a week (vnDay = its Monday) always add up to the week's extra points, so a change is
 * a new entry with the difference. Returns the team that got an entry, or null.
 */
async function applyPlayerWeek(
  tx: Tx,
  tournamentId: string,
  t: Settings,
  userId: string,
  weekStart: string,
  now: Date,
): Promise<string | null> {
  const { start, end } = vnWeekRange(weekStart);
  const lastDay = vnDayKey(new Date(end.getTime() - 1));
  const key = { tournamentId_userId_weekStart: { tournamentId, userId, weekStart } };
  const [results, distance, given, previous, existing] = await Promise.all([
    tx.swimResult.findMany({
      where: {
        tournamentId,
        userId,
        status: "VERIFIED",
        swim: { startedAt: { gte: start, lt: end } },
      },
      select: { teamId: true, swim: { select: { startedAt: true, distanceM: true } } },
      orderBy: { swim: { startedAt: "asc" } },
    }),
    tx.pointsEntry.aggregate({
      where: {
        tournamentId,
        userId,
        kind: "DISTANCE",
        vnDay: { gte: weekStart, lte: lastDay },
        swimResult: { status: "VERIFIED" },
      },
      _sum: { points: true },
    }),
    tx.pointsEntry.aggregate({
      where: { tournamentId, userId, kind: "WEEKLY_MULTIPLIER", vnDay: weekStart },
      _sum: { points: true },
    }),
    tx.weeklyResult.findUnique({
      where: {
        tournamentId_userId_weekStart: {
          tournamentId,
          userId,
          weekStart: previousWeekStart(weekStart),
        },
      },
      select: { streakWeeks: true },
    }),
    tx.weeklyResult.findUnique({ where: key, select: { teamId: true } }),
  ]);
  if (results.length === 0 && !existing) return null;

  const days = activeDays(
    results.map(({ swim }) => ({
      startedAt: swim.startedAt,
      distanceM: Math.min(swim.distanceM, t.longestSwimCountedM),
    })),
  );
  const multiplierPct = weeklyMultiplierPct({
    activeDays: days,
    previousThreePlusStreak: previous?.streakWeeks ?? 0,
    values: {
      multiplier2DaysPct: t.multiplierTwoDaysPct,
      multiplier3DaysPct: t.multiplierThreeDaysPct,
      multiplierStreakStepPct: t.streakStepPct,
      multiplierMaxPct: t.multiplierMaxPct,
    },
  });
  const distancePoints = distance._sum.points ?? 0;
  const extra = extraPoints(distancePoints, multiplierPct);
  const teamId =
    existing?.teamId ??
    (await teamAtWeekEnd(tx, tournamentId, userId, end)) ??
    results[results.length - 1].teamId;
  const row = {
    activeDays: days,
    multiplierPct,
    distancePoints,
    extraPoints: extra,
    streakWeeks: days >= 3 ? (previous?.streakWeeks ?? 0) + 1 : 0,
  };
  await tx.weeklyResult.upsert({
    where: key,
    create: { tournamentId, userId, teamId, weekStart, settledAt: now, ...row },
    update: row,
  });
  const diff = extra - (given._sum.points ?? 0);
  if (diff === 0) return null;
  await tx.pointsEntry.create({
    data: {
      tournamentId,
      userId,
      teamId,
      kind: "WEEKLY_MULTIPLIER",
      points: diff,
      vnDay: weekStart,
    },
  });
  return teamId;
}

const sorted = (teams: Set<string>) => [...teams].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * Settles the weekly multiplier (S-21, FR-49, BR-30) of one tournament for the week starting
 * `weekStart` (Monday, Vietnam time) once: claims the `WeekSettlement` row first, so a repeated
 * or concurrent call does nothing and returns false. Every player with a verified result that
 * week gets a `WeeklyResult` and, when the multiplier adds points, a WEEKLY_MULTIPLIER entry
 * for their team when the week ended; then the progress of those teams is refreshed.
 * Weeks must be settled oldest first: the streak reads the previous week's `WeeklyResult`.
 */
export async function settleWeek(
  tournamentId: string,
  weekStart: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { start, end } = vnWeekRange(weekStart);
  return db.$transaction(
    async (tx) => {
      const claimed = await tx.weekSettlement.createMany({
        data: [{ tournamentId, weekStart, settledAt: now }],
        skipDuplicates: true,
      });
      if (claimed.count === 0) return false;
      const t = await settingsOf(tx, tournamentId);
      const players = await tx.swimResult.findMany({
        where: { tournamentId, status: "VERIFIED", swim: { startedAt: { gte: start, lt: end } } },
        distinct: ["userId"],
        select: { userId: true },
        orderBy: { userId: "asc" },
      });
      const teams = new Set<string>();
      for (const { userId } of players) {
        await lockPlayerPoints(tx, tournamentId, userId);
        const team = await applyPlayerWeek(tx, tournamentId, t, userId, weekStart, now);
        if (team) teams.add(team);
      }
      for (const teamId of sorted(teams)) await updateTeamProgress(tx, tournamentId, teamId, now);
      return true;
    },
    { timeout: 60_000 },
  );
}

/**
 * Recomputes a player's settled week after their results changed (S-46), and every later
 * settled week, since their streaks depend on it. Each change is a new WEEKLY_MULTIPLIER entry
 * with the difference (positive or negative); earlier entries are never edited. Does nothing for
 * a week that is not settled yet. Returns the teams whose points changed, in ascending order:
 * the caller refreshes their progress (`updateTeamProgress`) in its own lock order.
 */
export async function recalculatePlayerWeek(
  tx: Tx,
  tournamentId: string,
  userId: string,
  weekStart: string,
  now: Date = new Date(),
): Promise<string[]> {
  vnWeekRange(weekStart);
  const settled = await tx.weekSettlement.findMany({
    where: { tournamentId, weekStart: { gte: weekStart } },
    select: { weekStart: true },
    orderBy: { weekStart: "asc" },
  });
  if (settled[0]?.weekStart !== weekStart) return [];
  await lockPlayerPoints(tx, tournamentId, userId);
  const t = await settingsOf(tx, tournamentId);
  const teams = new Set<string>();
  for (const week of settled) {
    const team = await applyPlayerWeek(tx, tournamentId, t, userId, week.weekStart, now);
    if (team) teams.add(team);
  }
  return sorted(teams);
}
