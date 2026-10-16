import type { SwimResult } from "@prisma/client";
import type { Tx } from "@/server/checks/run-checks";
import { awardBadge } from "./award";

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
