import { db } from "@/server/db";

export type PlayerTotals = { points: number; countedM: number };

/** Points and verified metres per user in one tournament; users without entries get zeros. */
export async function getPlayerTotals(
  tournamentId: string,
  userIds: string[],
): Promise<Map<string, PlayerTotals>> {
  const totals = new Map<string, PlayerTotals>(
    userIds.map((id) => [id, { points: 0, countedM: 0 }]),
  );
  if (userIds.length === 0) return totals;
  const rows = await db.pointsEntry.groupBy({
    by: ["userId"],
    where: { tournamentId, userId: { in: userIds } },
    _sum: { points: true, countedM: true },
  });
  for (const row of rows) {
    totals.set(row.userId, { points: row._sum.points ?? 0, countedM: row._sum.countedM ?? 0 });
  }
  return totals;
}

/**
 * Points of every team in the tournament (0 for an empty team). Points follow the member:
 * summed over the team's current ACTIVE members, whatever team the entry was earned for.
 */
export async function getTeamsPoints(tournamentId: string): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ teamId: string; points: bigint }[]>`
    SELECT t."id" AS "teamId", COALESCE(SUM(p."points"), 0) AS "points"
    FROM "Team" t
    LEFT JOIN "TeamMember" m
      ON m."teamId" = t."id" AND m."tournamentId" = t."tournamentId" AND m."status" = 'ACTIVE'
    LEFT JOIN "PointsEntry" p
      ON p."userId" = m."userId" AND p."tournamentId" = t."tournamentId"
    WHERE t."tournamentId" = ${tournamentId}
    GROUP BY t."id"`;
  return new Map(rows.map((row) => [row.teamId, Number(row.points)]));
}

/** Points of one team (0 when the team has no scoring members or does not exist). */
export async function getTeamPoints(tournamentId: string, teamId: string): Promise<number> {
  return (await getTeamsPoints(tournamentId)).get(teamId) ?? 0;
}
