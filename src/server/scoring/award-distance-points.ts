import type { SwimResult } from "@prisma/client";
import { countDistance } from "@/lib/scoring/distance-points";
import { vnDayKey } from "@/lib/time/vn";
import type { Tx } from "@/server/checks/run-checks";

/**
 * Serializes the distance awards of one player in one tournament until the transaction ends,
 * so two awards for the same day cannot both read the old daily total.
 */
async function lockPlayerPoints(tx: Tx, tournamentId: string, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`points:${tournamentId}:${userId}`}))`;
}

/**
 * Gives a VERIFIED result its one DISTANCE points entry (S-13, FR-49, FR-78): the swim counts up
 * to the tournament's longest-swim setting and what is left of the player's daily limit for the
 * swim's Vietnam day in this tournament. Sets `SwimResult.countedM`. Calling it again for the
 * same result changes nothing; results that are not VERIFIED get nothing (BR-04).
 */
export async function awardDistancePoints(tx: Tx, result: SwimResult): Promise<void> {
  if (result.status !== "VERIFIED") return;
  const { tournamentId, userId } = result;
  await lockPlayerPoints(tx, tournamentId, userId);

  const existing = await tx.pointsEntry.findUnique({
    where: { swimResultId_kind: { swimResultId: result.id, kind: "DISTANCE" } },
    select: { id: true },
  });
  if (existing) return;

  const { swim, tournament } = await tx.swimResult.findUniqueOrThrow({
    where: { id: result.id },
    select: {
      swim: { select: { startedAt: true, distanceM: true } },
      tournament: { select: { longestSwimCountedM: true, dailyLimitM: true, pointsPerKm: true } },
    },
  });
  const vnDay = vnDayKey(swim.startedAt);
  const today = await tx.pointsEntry.aggregate({
    where: { tournamentId, userId, vnDay, kind: "DISTANCE" },
    _sum: { countedM: true },
  });
  const { countedM, points } = countDistance({
    distanceM: swim.distanceM,
    ...tournament,
    alreadyCountedTodayM: today._sum.countedM ?? 0,
  });

  await tx.pointsEntry.create({
    data: {
      tournamentId,
      userId,
      teamId: result.teamId,
      swimResultId: result.id,
      kind: "DISTANCE",
      points,
      countedM,
      vnDay,
    },
  });
  await tx.swimResult.update({ where: { id: result.id }, data: { countedM } });
}
