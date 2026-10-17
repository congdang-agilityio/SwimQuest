import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/server/http/api-error";
import {
  runDueSeasonEnds,
  runDueSeasonStarts,
  runDueStartAssignments,
  runDueWeekSettlements,
  runDueXpWeekSettlements,
  runPendingPushes,
} from "@/server/jobs/tick";

export const dynamic = "force-dynamic";

/** Hashing both sides gives equal-length buffers, so the compare leaks neither value nor length. */
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Scheduler entry point, protected by `Authorization: Bearer <CRON_SECRET>` instead of a user
 * session. 503 when `CRON_SECRET` is not configured, 401 for a missing or wrong secret.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return apiError(503, "SERVICE_UNAVAILABLE");

  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!given || !sameSecret(given, secret)) return apiError(401, "UNAUTHENTICATED");

  const startAssignments = await runDueStartAssignments(new Date());
  const seasonStarts = await runDueSeasonStarts(new Date());
  const weekSettlements = await runDueWeekSettlements(new Date());
  const seasonEnds = await runDueSeasonEnds(new Date());
  const xpWeekSettlements = await runDueXpWeekSettlements(new Date());
  const pushes = await runPendingPushes();
  return NextResponse.json(
    { startAssignments, seasonStarts, weekSettlements, seasonEnds, xpWeekSettlements, pushes },
    { headers: { "cache-control": "no-store" } },
  );
}
