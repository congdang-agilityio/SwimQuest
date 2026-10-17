import { db } from "@/server/db";
import { routeProgress } from "@/lib/scoring/progress";
import { effectiveStatus, type TournamentStatus } from "@/lib/tournaments/lifecycle";
import { getTeamsPoints } from "@/server/scoring/team-points";

export type MyTournament = {
  id: string;
  name: string;
  effectiveStatus: TournamentStatus;
  seasonStartAt: Date;
  seasonEndAt: Date;
  isOrganizer: boolean;
  /** An active review helper of this tournament (S-45): may open its review queue. */
  isReviewHelper: boolean;
  team: { id: string; name: string; emblemKey: string } | null;
  /** Team progress in basis points; null when there is no team or its start is not chosen yet. */
  progressBp: number | null;
};

/**
 * Tournaments the user plays in (ACTIVE membership) or organizes, newest join/creation first.
 * A draft is private to its organizer. Progress is the player's team progress (null without a team or a chosen start).
 */
export async function listMyTournaments(userId: string, now: Date): Promise<MyTournament[]> {
  const [memberships, organized, helperRows] = await Promise.all([
    db.teamMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: { team: true, tournament: true },
    }),
    db.tournament.findMany({ where: { organizerId: userId } }),
    db.reviewHelper.findMany({
      where: { userId, removedAt: null },
      select: { tournamentId: true },
    }),
  ]);
  const helperOf = new Set(helperRows.map((h) => h.tournamentId));

  const rows = new Map<
    string,
    {
      tournament: (typeof organized)[number];
      team: MyTournament["team"];
      startChosen: boolean;
      sortAt: number;
    }
  >();
  for (const m of memberships) {
    if (m.tournament.status === "DRAFT" && m.tournament.organizerId !== userId) continue;
    const { id, name, emblemKey, startDestination } = m.team;
    rows.set(m.tournamentId, {
      tournament: m.tournament,
      team: { id, name, emblemKey },
      startChosen: startDestination !== null,
      sortAt: m.joinedAt.getTime(),
    });
  }
  for (const t of organized) {
    const existing = rows.get(t.id);
    if (existing) existing.sortAt = Math.max(existing.sortAt, t.createdAt.getTime());
    else
      rows.set(t.id, {
        tournament: t,
        team: null,
        startChosen: false,
        sortAt: t.createdAt.getTime(),
      });
  }

  const entries = [...rows.values()].sort((a, b) => b.sortAt - a.sortAt);
  return Promise.all(
    entries.map(async ({ tournament: t, team, startChosen }) => {
      let progressBp: number | null = null;
      if (team && startChosen) {
        const points = (await getTeamsPoints(t.id)).get(team.id) ?? 0;
        progressBp = routeProgress({
          teamPoints: points,
          routeDistanceM: t.routeDistanceM,
          pointsPerKm: t.pointsPerKm,
        }).progressBp;
      }
      return {
        id: t.id,
        name: t.name,
        effectiveStatus: effectiveStatus(t, now),
        seasonStartAt: t.seasonStartAt,
        seasonEndAt: t.seasonEndAt,
        isOrganizer: t.organizerId === userId,
        // Same rule as the queue page: an active helper who still plays in the tournament.
        isReviewHelper: helperOf.has(t.id) && team !== null,
        team,
        progressBp,
      };
    }),
  );
}

/** The most recently joined ACTIVE membership, or null (My Team and Voyage until S-69). */
export async function getCurrentMembership(userId: string) {
  const m = await db.teamMember.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
    include: { team: true, tournament: true },
  });
  return m ? { tournament: m.tournament, team: m.team } : null;
}
