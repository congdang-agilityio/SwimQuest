import type { Prisma, Swim, Tournament } from "@prisma/client";
import { utcToVnParts } from "@/lib/time/vn";
import { NotFoundError, requireReviewer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { PUBLIC_PLAYER_SELECT, type PublicPlayer } from "@/server/users/public-player";

/** Most points a reviewer gets of a swim's track: enough for its shape, not every fix. */
export const MAX_TRACK_POINTS = 500;

/** A failed check with the tournament's limit and the swim's value (pace in s per 100 m). */
export type ReviewReason = {
  code: string;
  limit: number | { seasonStartAt: string; seasonEndAt: string } | null;
  value: number | string | null;
};

/** One flagged swim as a reviewer sees it: a public player, never an email or the track. */
export type ReviewQueueItem = {
  resultId: string;
  swimId: string;
  player: PublicPlayer;
  /** UTC instant (ISO 8601) and Vietnam local date (YYYY-MM-DD). */
  startedAt: string;
  date: string;
  distanceM: number;
  durationS: number;
  pacePer100mS: number | null;
  swimType: Swim["swimType"];
  reasons: ReviewReason[];
};

export type ReviewItem = ReviewQueueItem & {
  tournamentId: string;
  status: string;
  /** Simplified track, at most MAX_TRACK_POINTS points; reviewers of the tournament only. */
  track: { lat: number; lon: number }[];
  /** Set for an open dispute: the player's reason and the status the result had before. */
  dispute?: ReviewDispute;
};

export type ReviewDispute = { id: string; reason: string; previousStatus: string };

const include = {
  swim: true,
  user: { select: PUBLIC_PLAYER_SELECT },
  tournament: true,
} satisfies Prisma.SwimResultInclude;
type Row = Prisma.SwimResultGetPayload<{ include: typeof include }>;

const rawPace = (s: Pick<Swim, "distanceM" | "durationS">) =>
  s.distanceM > 0 ? s.durationS / (s.distanceM / 100) : null;
const roundWith = (round: (x: number) => number, x: number | null) =>
  x === null ? null : round(x);

/** A reason with its params. A failed pace is rounded away from its limit, never onto it. */
export function reasonOf(code: string, swim: Swim, t: Tournament): ReviewReason {
  switch (code) {
    case "PACE_TOO_FAST":
      return { code, limit: t.fastestPaceSecPer100m, value: roundWith(Math.floor, rawPace(swim)) };
    case "PACE_TOO_SLOW":
      return { code, limit: t.slowestPaceSecPer100m, value: roundWith(Math.ceil, rawPace(swim)) };
    case "DISTANCE_TOO_LONG":
      return { code, limit: t.longestRealisticSwimM, value: swim.distanceM };
    case "OUTSIDE_SEASON": {
      const limit = {
        seasonStartAt: t.seasonStartAt.toISOString(),
        seasonEndAt: t.seasonEndAt.toISOString(),
      };
      return { code, limit, value: swim.startedAt.toISOString() };
    }
    case "NO_DISTANCE":
      return { code, limit: null, value: swim.distanceM };
    case "NOT_A_SWIM":
      return { code, limit: null, value: swim.sport };
    default:
      return { code, limit: null, value: null };
  }
}

function toItem({ id, swim, user, tournament, reasons }: Row): ReviewQueueItem {
  const codes = Array.isArray(reasons) ? reasons.filter((r) => typeof r === "string") : [];
  return {
    resultId: id,
    swimId: swim.id,
    player: { id: user.id, displayName: user.displayName },
    startedAt: swim.startedAt.toISOString(),
    date: utcToVnParts(swim.startedAt).date,
    distanceM: swim.distanceM,
    durationS: swim.durationS,
    pacePer100mS: roundWith(Math.round, rawPace(swim)),
    swimType: swim.swimType,
    reasons: codes.map((c) => reasonOf(c, swim, tournament)),
  };
}

/** Keeps evenly spaced points, always the first and the last, and drops malformed ones. */
function simplifyTrack(track: Prisma.JsonValue | null): ReviewItem["track"] {
  const points = (Array.isArray(track) ? track : []).flatMap((p) => {
    const { lat, lon } = (p ?? {}) as { lat?: unknown; lon?: unknown };
    return typeof lat === "number" && typeof lon === "number" ? [{ lat, lon }] : [];
  });
  if (points.length <= MAX_TRACK_POINTS) return points;
  const step = (points.length - 1) / (MAX_TRACK_POINTS - 1);
  return Array.from({ length: MAX_TRACK_POINTS }, (_, i) => points[Math.round(i * step)]!);
}

/** The tournament's FLAGGED results, oldest flagged first. Reviewers only (S-43). */
export async function getReviewQueue(viewerId: string, tournamentId: string) {
  await requireReviewer(viewerId, tournamentId);
  const rows = await db.swimResult.findMany({
    where: { tournamentId, status: "FLAGGED" },
    include,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toItem);
}

/** One result with its simplified track, for reviewers of the result's tournament only. */
export async function getReviewItem(viewerId: string, resultId: string): Promise<ReviewItem> {
  if (typeof resultId !== "string" || resultId === "") throw new NotFoundError();
  const row = await db.swimResult.findUnique({ where: { id: resultId }, include });
  if (!row) throw new NotFoundError();
  // The row's tournament exists, so this throws only ForbiddenError (or a real DB error).
  await requireReviewer(viewerId, row.tournamentId);
  const track = simplifyTrack(row.swim.track);
  return { ...toItem(row), tournamentId: row.tournamentId, status: row.status, track };
}

/** The tournament's OPEN disputes, oldest first, each with the player's reason. Reviewers only. */
export async function getDisputeQueue(
  viewerId: string,
  tournamentId: string,
): Promise<{ resultId: string; dispute: ReviewDispute }[]> {
  await requireReviewer(viewerId, tournamentId);
  const rows = await db.dispute.findMany({
    where: { status: "OPEN", swimResult: { tournamentId, status: "DISPUTED" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((d) => ({
    resultId: d.swimResultId,
    dispute: { id: d.id, reason: d.reason, previousStatus: d.previousStatus },
  }));
}
