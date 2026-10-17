import type { SwimResult } from "@prisma/client";
import { previousWeekStart } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";
import { awardBadge, removeBadge } from "./award";
import { PERSEVERANCE_MIN_DAYS, PERSEVERANCE_WEEKS } from "./weekly-badges";

/** Counted metres in one tournament that earn the Conqueror badge (S-48 AC 2). */
export const CONQUEROR_M = 50_000;

/**
 * Checks the personal badges a newly VERIFIED result can earn (S-48, FR-51), inside the
 * caller's transaction and after its distance points set `countedM`:
 * - PARTICIPATION on the player's first verified result in the tournament;
 * - CONQUEROR once the player's counted metres of verified results there reach 50 km.
 * Each badge is given at most once per tournament and never adds points or XP.
 */
export async function checkPersonalBadgesOnVerified(tx: Tx, result: SwimResult): Promise<void> {
  if (result.status !== "VERIFIED") return;
  const { tournamentId, userId, teamId } = result;
  await awardBadge(tx, { tournamentId, userId, teamId, kind: "PARTICIPATION" });

  const counted = await tx.swimResult.aggregate({
    where: { tournamentId, userId, status: "VERIFIED" },
    _sum: { countedM: true },
  });
  if ((counted._sum.countedM ?? 0) >= CONQUEROR_M) {
    await awardBadge(tx, { tournamentId, userId, teamId, kind: "CONQUEROR" });
  }
}

/** Removal reason for a personal badge whose rule a revocation broke (S-48 AC 5). */
export const RULE_NO_LONGER_MET = "RULE_NO_LONGER_MET";

/** Whether the sorted Mondays contain `PERSEVERANCE_WEEKS` consecutive weeks. */
function hasConsecutiveWeeks(weeks: string[]): boolean {
  let run = 0;
  for (let i = 0; i < weeks.length; i++) {
    run = i > 0 && previousWeekStart(weeks[i]) === weeks[i - 1] ? run + 1 : 1;
    if (run >= PERSEVERANCE_WEEKS) return true;
  }
  return false;
}

/**
 * Re-checks a player's personal badges in a tournament after a revocation (S-48 AC 5), inside
 * the revoke transaction once the points are reversed and the settled weeks recalculated.
 * Removes (reason `RULE_NO_LONGER_MET`):
 * - PARTICIPATION when no VERIFIED result remains there;
 * - CONQUEROR when the counted metres of VERIFIED results fall below 50 km;
 * - PERSEVERANCE when the settled weeks no longer hold 4 consecutive weeks of 3+ active days.
 * A badge whose rule still holds is kept.
 */
export async function reevaluatePersonalBadges(
  tx: Tx,
  tournamentId: string,
  userId: string,
): Promise<void> {
  const ids = { tournamentId, userId };
  const held = await tx.badge.findMany({
    where: {
      ...ids,
      kind: { in: ["PARTICIPATION", "CONQUEROR", "PERSEVERANCE"] },
      removedAt: null,
    },
    select: { kind: true },
  });
  const kinds = new Set(held.map((b) => b.kind));
  if (kinds.size === 0) return;

  const counted = await tx.swimResult.aggregate({
    where: { ...ids, status: "VERIFIED" },
    _count: { _all: true },
    _sum: { countedM: true },
  });
  if (kinds.has("PARTICIPATION") && counted._count._all === 0) {
    await removeBadge(tx, { ...ids, kind: "PARTICIPATION" }, RULE_NO_LONGER_MET);
  }
  if (kinds.has("CONQUEROR") && (counted._sum.countedM ?? 0) < CONQUEROR_M) {
    await removeBadge(tx, { ...ids, kind: "CONQUEROR" }, RULE_NO_LONGER_MET);
  }
  if (kinds.has("PERSEVERANCE")) {
    const weeks = await tx.weeklyResult.findMany({
      where: { ...ids, activeDays: { gte: PERSEVERANCE_MIN_DAYS } },
      select: { weekStart: true },
      orderBy: { weekStart: "asc" },
    });
    if (!hasConsecutiveWeeks(weeks.map((w) => w.weekStart))) {
      await removeBadge(tx, { ...ids, kind: "PERSEVERANCE" }, RULE_NO_LONGER_MET);
    }
  }
}
