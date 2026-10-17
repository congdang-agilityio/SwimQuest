import type { HealthSignalKind } from "@prisma/client";
import { db } from "@/server/db";
import { requirePlatformAdmin } from "@/server/auth/roles";
import type { AdminActor } from "./users";

const DAY_MS = 24 * 3600_000;

export type MetricsRange = { from: Date; to: Date };

export type FunnelStepKey = "signedUp" | "joined" | "firstSwim" | "finished";
export type FunnelStep = {
  key: FunnelStepKey;
  /** Distinct users in the range. */
  users: number;
  /** Share of the previous step in percent (whole number); null for the first step or at 0. */
  conversionPct: number | null;
};

export type HealthSummary = {
  kind: HealthSignalKind;
  last7Days: number;
  last30Days: number;
  topPaths: { path: string; count: number }[];
};

export type PlatformMetrics = {
  range: { from: string; to: string };
  /** Number of recorded events per funnel event name, most frequent first. */
  events: { name: string; count: number }[];
  steps: FunnelStep[];
  health: HealthSummary[];
};

export function conversionPct(users: number, previous: number): number | null {
  return previous > 0 ? Math.round((users / previous) * 100) : null;
}

/** Distinct users with a funnel event of this name in [from, to). */
async function distinctUsers(name: string, { from, to }: MetricsRange): Promise<number> {
  const rows = await db.funnelEvent.groupBy({
    by: ["userId"],
    where: { name, userId: { not: null }, createdAt: { gte: from, lt: to } },
  });
  return rows.length;
}

async function health(kind: HealthSignalKind, now: Date): Promise<HealthSummary> {
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const [last7Days, last30Days, top] = await Promise.all([
    db.healthSignal.count({ where: { kind, createdAt: { gte: since7 } } }),
    db.healthSignal.count({ where: { kind, createdAt: { gte: since30 } } }),
    db.healthSignal.groupBy({
      by: ["path"],
      where: { kind, createdAt: { gte: since30 } },
      _count: { _all: true },
      orderBy: [{ _count: { path: "desc" } }, { path: "asc" }],
      take: 5,
    }),
  ]);
  return {
    kind,
    last7Days,
    last30Days,
    topPaths: top.map((r) => ({ path: r.path, count: r._count._all })),
  };
}

/**
 * Platform metrics for admins (S-83 AC 3 and 4): funnel counts for the range, the four main
 * steps as distinct users with the conversion between steps, and API / asset failure counts.
 * Aggregates only: no user names or ids leave this function.
 */
export async function getPlatformMetrics(
  admin: AdminActor,
  range: MetricsRange,
  now: Date = new Date(),
): Promise<PlatformMetrics> {
  requirePlatformAdmin(admin);
  const inRange = { gte: range.from, lt: range.to };
  const [eventRows, signedUp, joined, firstSwim, finishedRows, api, asset] = await Promise.all([
    db.funnelEvent.groupBy({
      by: ["name"],
      where: { createdAt: inRange },
      _count: { _all: true },
      orderBy: [{ _count: { name: "desc" } }, { name: "asc" }],
    }),
    distinctUsers("account_signup_completed", range),
    distinctUsers("tournament_joined", range),
    distinctUsers("activity_verification_passed", range),
    // Members of a team that finished in the range (the finish event itself has no user).
    db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT tm."userId") AS n
      FROM "TeamMember" tm
      JOIN "Team" t ON t."id" = tm."teamId" AND t."tournamentId" = tm."tournamentId"
      WHERE t."finishedAt" >= ${range.from} AND t."finishedAt" < ${range.to}`,
    health("API_FAILURE", now),
    health("ASSET_FAILURE", now),
  ]);
  const counts: [FunnelStepKey, number][] = [
    ["signedUp", signedUp],
    ["joined", joined],
    ["firstSwim", firstSwim],
    ["finished", Number(finishedRows[0]?.n ?? 0)],
  ];
  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    events: eventRows.map((r) => ({ name: r.name, count: r._count._all })),
    steps: counts.map(([key, users], i) => ({
      key,
      users,
      conversionPct: i === 0 ? null : conversionPct(users, counts[i - 1][1]),
    })),
    health: [api, asset],
  };
}
