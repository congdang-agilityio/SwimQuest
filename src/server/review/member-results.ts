import type { SwimResultStatus } from "@prisma/client";
import { utcToVnParts } from "@/lib/time/vn";
import { NotFoundError, requireReviewer } from "@/server/auth/roles";
import { db } from "@/server/db";

export type MemberResult = {
  resultId: string;
  /** UTC instant (ISO 8601) and Vietnam local date (YYYY-MM-DD) of the swim. */
  startedAt: string;
  date: string;
  distanceM: number;
  durationS: number;
  status: SwimResultStatus;
  /** Net points the result earned in this tournament (reversals included). */
  points: number;
};

export type MemberResults = {
  member: { id: string; displayName: string };
  results: MemberResult[];
};

/**
 * A member's results in one tournament, newest swim first, for its reviewers only. The member
 * must belong (or have belonged) to a team of the tournament, else NotFoundError. No track and
 * no email: only what the review page needs to open a result.
 */
export async function listMemberResults(
  reviewerId: string,
  tournamentId: string,
  userId: string,
): Promise<MemberResults> {
  await requireReviewer(reviewerId, tournamentId);
  if (typeof userId !== "string" || userId === "") throw new NotFoundError();
  const membership = await db.teamMember.findFirst({
    where: { tournamentId, userId },
    select: { user: { select: { id: true, displayName: true } } },
  });
  if (!membership) throw new NotFoundError();
  const rows = await db.swimResult.findMany({
    where: { tournamentId, userId },
    select: {
      id: true,
      status: true,
      swim: { select: { startedAt: true, distanceM: true, durationS: true } },
      pointsEntries: { select: { points: true } },
    },
    orderBy: [{ swim: { startedAt: "desc" } }, { id: "asc" }],
  });
  return {
    member: membership.user,
    results: rows.map((r) => ({
      resultId: r.id,
      startedAt: r.swim.startedAt.toISOString(),
      date: utcToVnParts(r.swim.startedAt).date,
      distanceM: r.swim.distanceM,
      durationS: r.swim.durationS,
      status: r.status,
      points: r.pointsEntries.reduce((n, e) => n + e.points, 0),
    })),
  };
}
