import { db } from "@/server/db";
import { byValueThenName, teamsFor } from "./points-leaderboard";

export type BadgesLeaderboardRow = {
  teamId: string;
  name: string;
  emblemKey: string;
  /** Active badges of this tournament held by the team's current active members. */
  badges: number;
  isMyTeam: boolean;
};

/**
 * Teams ranked by active badges (S-24 Badges tab): badges with `removedAt` null that belong to
 * this tournament and to a current active member, so a moved member's badges count for the new
 * team. Ties by name.
 */
export async function getBadgesLeaderboard(
  viewerId: string,
  tournamentId: string,
): Promise<BadgesLeaderboardRow[]> {
  const teams = await teamsFor(viewerId, tournamentId);
  const [members, badges] = await Promise.all([
    db.teamMember.findMany({
      where: { tournamentId, status: "ACTIVE" },
      select: { userId: true, teamId: true },
    }),
    db.badge.groupBy({
      by: ["userId"],
      where: { tournamentId, removedAt: null },
      _count: { _all: true },
    }),
  ]);
  const perUser = new Map(badges.map((b) => [b.userId, b._count._all]));
  const byTeam = new Map<string, number>();
  for (const m of members) {
    byTeam.set(m.teamId, (byTeam.get(m.teamId) ?? 0) + (perUser.get(m.userId) ?? 0));
  }
  const rows = teams.map((t) => ({ ...t, badges: byTeam.get(t.teamId) ?? 0 }));
  return rows.sort(byValueThenName((r) => r.badges));
}
