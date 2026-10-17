import type { XpKind } from "@prisma/client";
import { firstSwimBonus, longSwimBonus, PLATFORM_POINT_VALUES } from "@/lib/scoring/bonuses";
import { countDistance } from "@/lib/scoring/distance-points";
import { levelForXp } from "@/lib/scoring/levels";
import { vnDayKey, vnWeekStart } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";
import { emitEvent } from "@/server/events/emit";
import { recalculateXpWeek } from "./settle-xp-week";

/** Platform swim limits for XP (S-51): never a tournament's changed settings. */
export const XP_LONGEST_SWIM_M = 10_000;
export const XP_DAILY_LIMIT_M = 10_000;

/** Entries of `swimId` (not reversals) that no REVERSAL cancels yet. */
const live = (swimId: string) => ({
  swimId,
  kind: { not: "REVERSAL" as const },
  reversals: { none: {} },
});

async function totalXp(tx: Tx, userId: string): Promise<number> {
  const sum = await tx.xpEntry.aggregate({ where: { userId }, _sum: { xp: true } });
  return sum._sum.xp ?? 0;
}

/**
 * Brings a swim's XP in line with its results (S-51, FR-51, FR-82), inside the caller's
 * transaction and under a per-player lock:
 * - the swim has a VERIFIED result in any tournament and no XP entries yet: DISTANCE XP by the
 *   platform values (10 per km, 10 km longest swim, 10 km a Vietnam day across the player's live
 *   DISTANCE XP), FIRST_SWIM_BONUS once per player ever and LONG_SWIM_BONUS once per Vietnam day;
 * - the swim has no VERIFIED result but live entries: one REVERSAL per live entry. A REVERSAL
 *   keeps `swimId` null (unique (swimId, kind)) and points to the entry it cancels.
 * When the swim's Vietnam week is already settled, its weekly multiplier is recalculated with a
 * delta entry. Emits LEVEL_CHANGED when the player's level changes. Calling it again changes
 * nothing. A swim whose entries were reversed is not awarded again (the unique index keeps its
 * rows). Lock order: the caller's `lockPlayerSwims` first, then this per-player XP lock.
 */
export async function syncSwimXp(tx: Tx, swimId: string): Promise<void> {
  const swim = await tx.swim.findUniqueOrThrow({
    where: { id: swimId },
    select: { userId: true, startedAt: true, distanceM: true },
  });
  const { userId } = swim;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`xp:${userId}`}))`;

  const counts = (await tx.swimResult.count({ where: { swimId, status: "VERIFIED" } })) > 0;
  const before = await totalXp(tx, userId);
  if (counts) {
    if ((await tx.xpEntry.count({ where: { swimId } })) > 0) return;
    await award(tx, swimId, swim);
  } else {
    const entries = await tx.xpEntry.findMany({
      where: live(swimId),
      orderBy: { createdAt: "asc" },
    });
    if (entries.length === 0) return;
    for (const e of entries) {
      await tx.xpEntry.create({
        data: { userId, kind: "REVERSAL", xp: -e.xp, vnDay: e.vnDay, reversesId: e.id },
      });
    }
  }
  await recalculateXpWeek(tx, userId, vnWeekStart(swim.startedAt));
  const [fromLevel, toLevel] = [levelForXp(before), levelForXp(await totalXp(tx, userId))];
  if (fromLevel !== toLevel) {
    await emitEvent(tx, { type: "LEVEL_CHANGED", payload: { userId, fromLevel, toLevel } });
  }
}

async function award(
  tx: Tx,
  swimId: string,
  swim: { userId: string; startedAt: Date; distanceM: number },
): Promise<void> {
  const { userId } = swim;
  const vnDay = vnDayKey(swim.startedAt);
  const insert = (kind: XpKind, xp: number) =>
    tx.xpEntry.create({ data: { userId, swimId, kind, xp, vnDay } });

  // The day's counted metres so far: each earlier live swim counted up to the longest-swim
  // limit, and all of them together up to the daily limit.
  const today = await tx.xpEntry.findMany({
    where: { userId, vnDay, kind: "DISTANCE", reversals: { none: {} } },
    select: { swim: { select: { distanceM: true } } },
  });
  const sumM = today.reduce((s, e) => s + Math.min(e.swim?.distanceM ?? 0, XP_LONGEST_SWIM_M), 0);
  const { points } = countDistance({
    distanceM: swim.distanceM,
    longestSwimCountedM: XP_LONGEST_SWIM_M,
    dailyLimitM: XP_DAILY_LIMIT_M,
    alreadyCountedTodayM: Math.min(sumM, XP_DAILY_LIMIT_M),
    pointsPerKm: PLATFORM_POINT_VALUES.pointsPerKm,
  });
  await insert("DISTANCE", points);

  if ((await tx.xpEntry.count({ where: { userId, kind: "FIRST_SWIM_BONUS" } })) === 0) {
    await insert("FIRST_SWIM_BONUS", firstSwimBonus(PLATFORM_POINT_VALUES));
  }
  const long = longSwimBonus(Math.min(swim.distanceM, XP_LONGEST_SWIM_M), PLATFORM_POINT_VALUES);
  const hasLong = await tx.xpEntry.count({
    where: { userId, vnDay, kind: "LONG_SWIM_BONUS", reversals: { none: {} } },
  });
  if (long > 0 && hasLong === 0) await insert("LONG_SWIM_BONUS", long);
}
