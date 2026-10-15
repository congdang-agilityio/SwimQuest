import { db } from "@/server/db";
import { assignMissingStarts } from "@/server/starts/auto-assign";

export type StartAssignmentCounts = { tournaments: number; assigned: number; failed: number };

function assertValidDate(now: Date): void {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }
}

/**
 * Scheduled job (story S-94): runs `assignMissingStarts` for every PUBLISHED/ACTIVE tournament
 * whose start lock time (`startChoiceDeadlineAt`, else `seasonStartAt`) is at or before `now`
 * and that still has a team without a start. A tournament that fails is logged and counted in
 * `failed`; the others still run. Safe to repeat: assigned teams are not picked up again.
 */
export async function runDueStartAssignments(now: Date): Promise<StartAssignmentCounts> {
  assertValidDate(now);
  const due = await db.tournament.findMany({
    where: {
      status: { in: ["PUBLISHED", "ACTIVE"] },
      teams: { some: { startDestination: null } },
      OR: [
        { startChoiceDeadlineAt: { lte: now } },
        { startChoiceDeadlineAt: null, seasonStartAt: { lte: now } },
      ],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const counts: StartAssignmentCounts = { tournaments: 0, assigned: 0, failed: 0 };
  for (const { id } of due) {
    try {
      counts.assigned += (await assignMissingStarts(id, now)).length;
      counts.tournaments += 1;
    } catch (error) {
      counts.failed += 1;
      console.error(`tick: start assignment failed for tournament ${id}`, error);
    }
  }
  return counts;
}

/**
 * Catch-up for pages that show starts: assigns missing starts when the deadline has passed,
 * since the scheduler runs only every few minutes. Before the deadline, or when every team has
 * a start, it is a cheap no-op (one tournament read and one count, no lock). Returns the
 * number of starts assigned. A failure (for example a lock wait timeout) is logged and returns
 * 0, so the page still loads with the current data; the scheduler retries later.
 */
export async function ensureStartsAssigned(tournamentId: string, now: Date): Promise<number> {
  try {
    return (await assignMissingStarts(tournamentId, now)).length;
  } catch (error) {
    console.error(`ensureStartsAssigned: catch-up failed for tournament ${tournamentId}`, error);
    return 0;
  }
}
