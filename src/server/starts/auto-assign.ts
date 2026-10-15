import { getRoute, startDestinations } from "@/lib/routes";
import { isStartLocked, type TournamentStatus } from "@/lib/tournaments/lifecycle";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { db } from "@/server/db";

export type AutoAssignment = { teamId: string; slug: string };

type LockedTournament = {
  status: TournamentStatus;
  seasonStartAt: Date;
  seasonEndAt: Date;
  startChoiceDeadlineAt: Date | null;
  routeId: string;
};

type LockedTeam = { id: string; startDestination: string | null };

/** Fisher-Yates shuffle driven by the injected `random` (values in [0, 1)). */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pick(i + 1, random);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A uniform index in [0, n); out-of-range `random` values are clamped. */
function pick(n: number, random: () => number): number {
  const r = random();
  const index = Math.floor((Number.isFinite(r) ? r : 0) * n);
  return Math.min(Math.max(index, 0), n - 1);
}

/**
 * Gives every team of the tournament that has no start the least-chosen start (story S-94,
 * FR-84, A-28). Does nothing before the start-choice deadline (`now`, the server clock).
 * Otherwise, in one transaction with the tournament row and its teams locked (so concurrent
 * runs are serialised and a second run finds nothing to do), it counts the teams per start
 * among the route's starts (never the finish, Lý Sơn), takes the teams without a start in a
 * random order and gives each one a start picked at random among those with the lowest count,
 * counting it before the next team. Teams that already have a start are never changed. Each
 * assignment is audited as a system action. Returns the assignments made, in order.
 */
export async function assignMissingStarts(
  tournamentId: string,
  now: Date,
  random: () => number = Math.random,
): Promise<AutoAssignment[]> {
  if (typeof tournamentId !== "string" || tournamentId.length === 0) {
    throw new TypeError("tournamentId must be a non-empty string");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  return db.$transaction(
    async (tx) => {
      const [tournament] = await tx.$queryRaw<LockedTournament[]>`
        SELECT "status", "seasonStartAt", "seasonEndAt", "startChoiceDeadlineAt", "routeId"
        FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE`;
      if (!tournament || !isStartLocked(tournament, now)) return [];
      const route = getRoute(tournament.routeId);
      if (!route) return [];

      const teams = await tx.$queryRaw<LockedTeam[]>`
        SELECT "id", "startDestination" FROM "Team"
        WHERE "tournamentId" = ${tournamentId} ORDER BY "id" FOR UPDATE`;
      const counts = new Map(startDestinations(route).map((d) => [d.slug, 0]));
      for (const t of teams) {
        const count = t.startDestination === null ? undefined : counts.get(t.startDestination);
        if (count !== undefined) counts.set(t.startDestination!, count + 1);
      }

      const open = teams.filter((t) => t.startDestination === null);
      const assignments: AutoAssignment[] = [];
      for (const team of shuffle(open, random)) {
        const lowest = Math.min(...counts.values());
        const candidates = [...counts].filter(([, c]) => c === lowest).map(([slug]) => slug);
        const slug = candidates[pick(candidates.length, random)];
        counts.set(slug, lowest + 1);

        await tx.team.update({
          where: { id: team.id },
          data: { startDestination: slug, startSetAt: now, startSetBy: "AUTOMATIC" },
        });
        const ids = { teamId: team.id, tournamentId };
        await recordAudit(tx, {
          actor: { type: "SYSTEM" },
          action: AUDIT_ACTIONS.TEAM_START_AUTO_ASSIGNED,
          entityType: "Team",
          entityId: team.id,
          tournamentId,
          before: { ...ids, startDestination: null },
          after: {
            ...ids,
            startDestination: slug,
            startSetAt: now.toISOString(),
            startSetBy: "AUTOMATIC",
          },
        });
        assignments.push({ teamId: team.id, slug });
      }
      return assignments;
    },
    // Concurrent runs wait for the tournament lock inside their transaction.
    { timeout: 30_000 },
  );
}
