import { db } from "@/server/db";
import { LeaderboardError } from "./progress-leaderboard";

export type PointsLeaderboardRow = {
  teamId: string;
  name: string;
  emblemKey: string;
  /** Team points only (all kinds, reversals included); keeps counting after the finish. */
  points: number;
  isMyTeam: boolean;
};

export type KmLeaderboardRow = {
  teamId: string;
  name: string;
  emblemKey: string;
  /** Verified metres that count in the tournament (after its caps); never bonuses or points. */
  countedM: number;
  isMyTeam: boolean;
};

export type Base = { teamId: string; name: string; emblemKey: string; isMyTeam: boolean };

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Loads the teams and enforces the access rule: active members and the organizer only. */
export async function teamsFor(viewerId: string, tournamentId: string): Promise<Base[]> {
  if (
    typeof viewerId !== "string" ||
    !viewerId ||
    typeof tournamentId !== "string" ||
    !tournamentId
  ) {
    throw new LeaderboardError("FORBIDDEN");
  }
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true },
  });
  if (!tournament) throw new LeaderboardError("FORBIDDEN");
  const teams = await db.team.findMany({
    where: { tournamentId },
    select: {
      id: true,
      name: true,
      emblemKey: true,
      members: { where: { status: "ACTIVE" }, select: { userId: true } },
    },
  });
  const mine = teams.find((t) => t.members.some((m) => m.userId === viewerId))?.id ?? null;
  if (!mine && tournament.organizerId !== viewerId) throw new LeaderboardError("FORBIDDEN");
  return teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    emblemKey: t.emblemKey,
    isMyTeam: t.id === mine,
  }));
}

export const byValueThenName =
  <T extends Base>(value: (r: T) => number) =>
  (a: T, b: T) =>
    value(b) - value(a) || cmp(a.name, b.name) || cmp(a.teamId, b.teamId);

/** Teams ranked by team points (S-22 Points tab): sum of the team's entries, ties by name. */
export async function getPointsLeaderboard(
  viewerId: string,
  tournamentId: string,
): Promise<PointsLeaderboardRow[]> {
  const teams = await teamsFor(viewerId, tournamentId);
  const sums = await db.pointsEntry.groupBy({
    by: ["teamId"],
    where: { tournamentId },
    _sum: { points: true },
  });
  const byTeam = new Map(sums.map((s) => [s.teamId, s._sum.points ?? 0]));
  const rows = teams.map((t) => ({ ...t, points: byTeam.get(t.teamId) ?? 0 }));
  return rows.sort(byValueThenName((r) => r.points));
}

/**
 * Teams ranked by verified counted metres (S-22 Total km tab): `countedM` of DISTANCE entries
 * plus their reversals, so bonuses and multipliers never count. Ties by name.
 */
export async function getKmLeaderboard(
  viewerId: string,
  tournamentId: string,
): Promise<KmLeaderboardRow[]> {
  const teams = await teamsFor(viewerId, tournamentId);
  const sums = await db.pointsEntry.groupBy({
    by: ["teamId"],
    where: { tournamentId, kind: { in: ["DISTANCE", "REVERSAL"] } },
    _sum: { countedM: true },
  });
  const byTeam = new Map(sums.map((s) => [s.teamId, s._sum.countedM ?? 0]));
  const rows = teams.map((t) => ({ ...t, countedM: Math.max(0, byTeam.get(t.teamId) ?? 0) }));
  return rows.sort(byValueThenName((r) => r.countedM));
}
