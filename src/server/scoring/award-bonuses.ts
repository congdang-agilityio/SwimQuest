import type { PointsKind, SwimResult } from "@prisma/client";
import { firstSwimBonus, longSwimBonus } from "@/lib/scoring/bonuses";
import { vnDayKey } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";
import { lockPlayerPoints } from "./award-distance-points";

/**
 * Gives a VERIFIED result its bonus points entries (S-20, FR-49, BR-29), under the same player
 * lock as the distance points so concurrent verifications cannot both see "no bonus yet":
 * - FIRST_SWIM_BONUS when the player has none yet in this tournament;
 * - LONG_SWIM_BONUS (tier 1, or tier 2 instead) when the player has none yet for the swim's
 *   Vietnam day in this tournament. The distance is the swim's distance after the tournament's
 *   longest-swim setting (story note).
 * Point values come from the tournament. Calling it again for the same result inserts nothing.
 */
export async function awardBonuses(tx: Tx, result: SwimResult): Promise<void> {
  if (result.status !== "VERIFIED") return;
  const { tournamentId, userId } = result;
  await lockPlayerPoints(tx, tournamentId, userId);

  const { swim, tournament } = await tx.swimResult.findUniqueOrThrow({
    where: { id: result.id },
    select: {
      swim: { select: { startedAt: true, distanceM: true } },
      tournament: {
        select: {
          longestSwimCountedM: true,
          firstSwimBonusPoints: true,
          longSwimTier1M: true,
          longSwimTier1Points: true,
          longSwimTier2M: true,
          longSwimTier2Points: true,
        },
      },
    },
  });
  const vnDay = vnDayKey(swim.startedAt);
  const has = async (kind: PointsKind, day?: string) =>
    (await tx.pointsEntry.count({ where: { tournamentId, userId, kind, vnDay: day } })) > 0;
  const insert = (kind: PointsKind, points: number) =>
    tx.pointsEntry.create({
      data: {
        tournamentId,
        userId,
        teamId: result.teamId,
        swimResultId: result.id,
        kind,
        points,
        vnDay,
      },
    });

  if (!(await has("FIRST_SWIM_BONUS"))) {
    await insert(
      "FIRST_SWIM_BONUS",
      firstSwimBonus({ firstSwimPoints: tournament.firstSwimBonusPoints }),
    );
  }
  const long = longSwimBonus(Math.min(swim.distanceM, tournament.longestSwimCountedM), tournament);
  if (long > 0 && !(await has("LONG_SWIM_BONUS", vnDay))) {
    await insert("LONG_SWIM_BONUS", long);
  }
}
