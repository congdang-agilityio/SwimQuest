import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { assignMissingStarts } from "@/server/starts/auto-assign";

export type StartAssignmentCounts = { tournaments: number; assigned: number; failed: number };

function assertValidDate(now: Date): void {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }
}

/**
 * Emits `TEAM_START_LOCKED` once per team when a tournament's start lock time has passed and
 * every team has a start. `startLockProcessedAt` is claimed first in the same transaction (a
 * conditional update), so a repeated or concurrent tick emits nothing more. A tournament that
 * still has a team without a start (assignment failed) is left for the next tick. Only
 * tournaments that are effectively PUBLISHED/ACTIVE (season not ended) are considered, so a
 * completed tournament never emits lock events.
 */
async function emitDueStartLocks(now: Date): Promise<void> {
  const due = await db.tournament.findMany({
    where: {
      status: { in: ["PUBLISHED", "ACTIVE"] },
      seasonEndAt: { gt: now },
      startLockProcessedAt: null,
      OR: [
        { startChoiceDeadlineAt: { lte: now } },
        { startChoiceDeadlineAt: null, seasonStartAt: { lte: now } },
      ],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  for (const { id } of due) {
    try {
      await db.$transaction(async (tx) => {
        const claimed = await tx.tournament.updateMany({
          where: { id, startLockProcessedAt: null },
          data: { startLockProcessedAt: now },
        });
        if (claimed.count === 0) return;
        const teams = await tx.team.findMany({
          where: { tournamentId: id },
          select: { id: true, startDestination: true },
          orderBy: { id: "asc" },
        });
        if (teams.some((t) => t.startDestination === null)) throw new Error("START_MISSING");
        for (const t of teams) {
          await emitEvent(tx, {
            type: "TEAM_START_LOCKED",
            payload: { tournamentId: id, teamId: t.id, startId: t.startDestination! },
          });
        }
      });
    } catch (error) {
      console.error(`tick: start lock events failed for tournament ${id}`, error);
    }
  }
}

/**
 * Scheduled job (story S-94): runs `assignMissingStarts` for every PUBLISHED/ACTIVE tournament
 * whose start lock time (`startChoiceDeadlineAt`, else `seasonStartAt`) is at or before `now`
 * and that still has a team without a start. A tournament that fails is logged and counted in
 * `failed`; the others still run. Then emits the start-lock events once per tournament.
 * Safe to repeat: assigned teams are not picked up again.
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
  await emitDueStartLocks(now);
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
