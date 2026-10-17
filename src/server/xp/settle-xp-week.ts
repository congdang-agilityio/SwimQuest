import { levelForXp } from "@/lib/scoring/levels";
import { PLATFORM_POINT_VALUES } from "@/lib/scoring/bonuses";
import { activeDays, extraPoints, weeklyMultiplierPct } from "@/lib/scoring/weekly-multiplier";
import { previousWeekStart, vnWeekRange, vnWeekStart } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";

const nextWeekStart = (week: string) => vnWeekStart(vnWeekRange(week).end);
const v = PLATFORM_POINT_VALUES;
/** Earlier 3+ weeks beyond this many no longer raise the multiplier (it is capped). */
const MAX_STREAK = Math.ceil(
  (v.multiplierMaxPct - v.multiplier3DaysPct) / v.multiplierStreakStepPct,
);

/**
 * Recomputes a player's settled XP week from the live DISTANCE entries of its Vietnam days, with
 * the platform multiplier (never a tournament's values). The streak counts the consecutive
 * earlier settled weeks at the 3+ day rate. A change in extra XP is a WEEKLY_MULTIPLIER entry
 * with the difference. Caller holds the player's XP lock.
 */
async function applyXpWeek(tx: Tx, userId: string, week: string, now: Date): Promise<void> {
  const entries = await tx.xpEntry.findMany({
    where: {
      userId,
      kind: "DISTANCE",
      reversals: { none: {} },
      vnDay: { gte: week, lt: nextWeekStart(week) },
    },
    select: { xp: true, swim: { select: { startedAt: true, distanceM: true } } },
  });
  const earlier = await tx.xpWeek.findMany({
    where: { userId, weekStart: { lt: week } },
    orderBy: { weekStart: "desc" },
    take: MAX_STREAK,
  });
  let streak = 0;
  for (let w = previousWeekStart(week); streak < earlier.length; w = previousWeekStart(w)) {
    const row = earlier[streak];
    if (row.weekStart !== w || row.multiplierPct < v.multiplier3DaysPct) break;
    streak += 1;
  }
  const multiplierPct = weeklyMultiplierPct({
    activeDays: activeDays(entries.flatMap((e) => (e.swim ? [e.swim] : []))),
    previousThreePlusStreak: streak,
  });
  const extraXp = extraPoints(
    entries.reduce((sum, e) => sum + e.xp, 0),
    multiplierPct,
  );
  const key = { userId_weekStart: { userId, weekStart: week } };
  const existing = await tx.xpWeek.findUnique({ where: key });
  await tx.xpWeek.upsert({
    where: key,
    create: { userId, weekStart: week, multiplierPct, extraXp, settledAt: now },
    update: { multiplierPct, extraXp },
  });
  const xp = extraXp - (existing?.extraXp ?? 0);
  if (xp !== 0) {
    await tx.xpEntry.create({ data: { userId, kind: "WEEKLY_MULTIPLIER", xp, weekStart: week } });
  }
}

/** Re-applies the player's settled XP weeks from `week` on (later streaks depend on it). */
async function applyFrom(tx: Tx, userId: string, week: string, now: Date): Promise<void> {
  const later = await tx.xpWeek.findMany({
    where: { userId, weekStart: { gt: week } },
    select: { weekStart: true },
    orderBy: { weekStart: "asc" },
  });
  await applyXpWeek(tx, userId, week, now);
  for (const { weekStart } of later) await applyXpWeek(tx, userId, weekStart, now);
}

/**
 * After a swim's XP changed (S-51 AC 5): when the player's week is already settled, recomputes
 * it and the later settled weeks. No-op for an unsettled week (the tick settles it). Runs in
 * `syncSwimXp`'s transaction, under its per-player XP lock.
 */
export async function recalculateXpWeek(
  tx: Tx,
  userId: string,
  weekStart: string,
  now = new Date(),
): Promise<void> {
  const settled = await tx.xpWeek.count({ where: { userId, weekStart } });
  if (settled > 0) await applyFrom(tx, userId, weekStart, now);
}

/**
 * Settles an ended Vietnam week's XP multiplier (S-51 AC 1) once per player: each player with
 * DISTANCE XP that week and no `XpWeek` row yet gets one, in their own transaction under the
 * per-player XP lock. Emits LEVEL_CHANGED when a level changes. Returns the players settled.
 */
export async function settleXpWeek(weekStart: string, now = new Date()): Promise<number> {
  if (vnWeekRange(weekStart).end > now) return 0;
  const players = await db.xpEntry.findMany({
    where: {
      kind: "DISTANCE",
      vnDay: { gte: weekStart, lt: nextWeekStart(weekStart) },
      user: { xpWeeks: { none: { weekStart } } },
    },
    distinct: ["userId"],
    select: { userId: true },
    orderBy: { userId: "asc" },
  });
  let settled = 0;
  for (const { userId } of players) {
    const done = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`xp:${userId}`}))`;
      if ((await tx.xpWeek.count({ where: { userId, weekStart } })) > 0) return false;
      const total = async () =>
        (await tx.xpEntry.aggregate({ where: { userId }, _sum: { xp: true } }))._sum.xp ?? 0;
      const fromLevel = levelForXp(await total());
      await applyFrom(tx, userId, weekStart, now);
      const toLevel = levelForXp(await total());
      if (fromLevel !== toLevel) {
        await emitEvent(tx, { type: "LEVEL_CHANGED", payload: { userId, fromLevel, toLevel } });
      }
      return true;
    });
    if (done) settled += 1;
  }
  return settled;
}

/** Mondays of ended weeks (before `now`'s week) with DISTANCE XP that some player has not settled. */
export async function dueXpWeeks(now: Date): Promise<string[]> {
  const rows = await db.$queryRaw<{ week: string }[]>`
    SELECT DISTINCT to_char(date_trunc('week', e."vnDay"::date), 'YYYY-MM-DD') AS week
    FROM "XpEntry" e
    WHERE e.kind = 'DISTANCE' AND e."vnDay" < ${vnWeekStart(now)}
      AND NOT EXISTS (
        SELECT 1 FROM "XpWeek" w
        WHERE w."userId" = e."userId"
          AND w."weekStart" = to_char(date_trunc('week', e."vnDay"::date), 'YYYY-MM-DD')
      )
    ORDER BY week`;
  return rows.map((r) => r.week);
}
