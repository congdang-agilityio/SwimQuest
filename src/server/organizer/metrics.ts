import { vnWeekRange, vnWeekStart } from "@/lib/time/vn";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { ACTIVE_SWIM_MIN_M, findActiveSwimmers } from "@/server/organizer/participation";

const WEEK_MS = 7 * 24 * 3600_000;

/** Statuses shown on their own; every other status counts as "other". */
export const METRIC_STATUSES = [
  "VERIFIED",
  "FLAGGED",
  "REJECTED",
  "DUPLICATE",
  "DISPUTED",
] as const;
export type MetricStatus = (typeof METRIC_STATUSES)[number] | "OTHER";

export type StatusShare = {
  status: MetricStatus;
  count: number;
  /** Whole percent; the shares add up to exactly 100 (largest remainder), or all 0 without results. */
  sharePct: number;
};

export type TournamentMetrics = {
  tournamentId: string;
  participation: {
    membersJoined: number;
    /** One entry per Vietnam week from the season start to now (or the season end). */
    weeklyActiveSwimmers: { weekStart: string; swimmers: number }[];
    activeMembersPerTeam: { teamId: string; teamName: string; activeMembers: number }[];
  };
  verification: {
    totalResults: number;
    shares: StatusShare[];
    /** Median minutes from upload to decision; null when nothing is decided yet. */
    medianMinutesToDecision: number | null;
    decidedResults: number;
  };
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** Whole-percent shares that add up to exactly 100 (largest remainder method). */
export function wholeShares(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const exact = counts.map((c) => (c * 100) / total);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  return out;
}

/**
 * Participation and verification metrics of one tournament (story S-80). Counts, shares and team
 * names only: no player names, emails or GPS data. Organizer only (the role errors of
 * `requireOrganizer`).
 */
export async function getTournamentMetrics(
  organizerId: string,
  tournamentId: string,
  now: Date = new Date(),
): Promise<TournamentMetrics> {
  await requireOrganizer(organizerId, tournamentId);
  const tournament = await db.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { seasonStartAt: true, seasonEndAt: true },
  });
  const { start: weekStart, end: weekEnd } = vnWeekRange(vnWeekStart(now));
  const seasonFirst = vnWeekRange(vnWeekStart(tournament.seasonStartAt)).start;
  const last = vnWeekRange(
    vnWeekStart(now < tournament.seasonEndAt ? now : tournament.seasonEndAt),
  ).start;

  const [teams, activeThisWeek, qualifying, results] = await Promise.all([
    db.team.findMany({
      where: { tournamentId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        members: { where: { status: "ACTIVE" }, select: { userId: true } },
      },
    }),
    findActiveSwimmers(tournamentId, weekStart, weekEnd),
    db.swimResult.findMany({
      where: {
        tournamentId,
        status: "VERIFIED",
        swim: { distanceM: { gte: ACTIVE_SWIM_MIN_M }, startedAt: { gte: seasonFirst } },
      },
      select: { userId: true, swim: { select: { startedAt: true } } },
    }),
    db.swimResult.findMany({
      where: { tournamentId },
      select: {
        status: true,
        createdAt: true,
        decidedAt: true,
        swim: { select: { createdAt: true } },
      },
    }),
  ]);

  const active = new Set(activeThisWeek.map((r) => `${r.teamId}:${r.userId}`));
  const byWeek = new Map<string, Set<string>>();
  for (const r of qualifying) {
    const key = vnWeekStart(r.swim.startedAt);
    (byWeek.get(key) ?? byWeek.set(key, new Set()).get(key)!).add(r.userId);
  }
  const weeklyActiveSwimmers: { weekStart: string; swimmers: number }[] = [];
  for (let t = seasonFirst.getTime(); t <= last.getTime(); t += WEEK_MS) {
    const key = vnWeekStart(new Date(t));
    weeklyActiveSwimmers.push({ weekStart: key, swimmers: byWeek.get(key)?.size ?? 0 });
  }

  const counts = new Map<MetricStatus, number>();
  const minutes: number[] = [];
  for (const r of results) {
    const known = (METRIC_STATUSES as readonly string[]).includes(r.status);
    const status = known ? (r.status as MetricStatus) : "OTHER";
    counts.set(status, (counts.get(status) ?? 0) + 1);
    // Flagged and disputed results wait for a reviewer until `decidedAt` is set.
    const waiting = r.decidedAt === null && (r.status === "FLAGGED" || r.status === "DISPUTED");
    if (waiting) continue;
    const decidedAt = r.decidedAt ?? r.createdAt;
    minutes.push(Math.max(0, (decidedAt.getTime() - r.swim.createdAt.getTime()) / 60_000));
  }
  const order: MetricStatus[] = [...METRIC_STATUSES, "OTHER"];
  const pct = wholeShares(order.map((s) => counts.get(s) ?? 0));
  const med = median(minutes);

  return {
    tournamentId,
    participation: {
      membersJoined: teams.reduce((n, t) => n + t.members.length, 0),
      weeklyActiveSwimmers,
      activeMembersPerTeam: teams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        activeMembers: t.members.filter((m) => active.has(`${t.id}:${m.userId}`)).length,
      })),
    },
    verification: {
      totalResults: results.length,
      shares: order.map((status, i) => ({
        status,
        count: counts.get(status) ?? 0,
        sharePct: pct[i]!,
      })),
      medianMinutesToDecision: med === null ? null : Math.round(med * 10) / 10,
      decidedResults: minutes.length,
    },
  };
}
