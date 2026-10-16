import { z } from "zod";
import type { PointsKind, SwimResultStatus } from "@prisma/client";
import {
  REASON_CODES,
  reasonCodeOf,
  type Reason,
  type ReasonCode,
  type StoredReason,
} from "@/server/checks/reasons";
import { db } from "@/server/db";
import { swimDtoInclude, toOwnerSwimDto, type OwnerSwimDto, type SwimResultDto } from "./swim-dto";

export class InvalidCursorError extends Error {
  constructor() {
    super("INVALID_CURSOR");
    this.name = "InvalidCursorError";
  }
}

/** One row of the player's swim list. `startedAt` is a UTC instant (ISO 8601). */
export type MySwimListItem = {
  id: string;
  startedAt: string;
  distanceM: number;
  durationS: number;
};
export type MySwimsPage = { items: MySwimListItem[]; nextCursor: string | null };

/** Status keys the UI turns into plain words ("did not count: rule missed" is `ruleMissed`). */
export type DisplayStatus =
  | "verified"
  | "waitingForReview"
  | "rejected"
  | "duplicate"
  | "disputed"
  | "revoked"
  | "ruleMissed";

export const DISPLAY_STATUS: Record<SwimResultStatus, DisplayStatus> = {
  VERIFIED: "verified",
  FLAGGED: "waitingForReview",
  REJECTED: "rejected",
  DUPLICATE: "duplicate",
  DISPUTED: "disputed",
  REVOKED: "revoked",
  RULE_MISSED: "ruleMissed",
};

export type MySwimResultDto = Omit<SwimResultDto, "reasons"> & {
  displayStatus: DisplayStatus;
  /** Known reasons only: plain codes, or `{ code, params }` from rule checks. */
  reasons: (ReasonCode | Reason)[];
  points: SwimPointsBreakdown;
};
/** `total` is the net of all ledger entries (reversals included); the rest are per kind. */
export type SwimPointsBreakdown = {
  distance: number;
  firstSwimBonus: number;
  longSwimBonus: number;
  total: number;
};
export type MySwimDto = Omit<OwnerSwimDto, "results"> & { results: MySwimResultDto[] };

const pageOptions = z.object({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

const cursorShape = z.object({ t: z.iso.datetime(), id: z.string().min(1).max(100) });

function encodeCursor(startedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: startedAt.toISOString(), id })).toString("base64url");
}

function decodeCursor(cursor: string): { startedAt: Date; id: string } {
  try {
    const { t, id } = cursorShape.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
    return { startedAt: new Date(t), id };
  } catch {
    throw new InvalidCursorError();
  }
}

/**
 * The player's own swims, newest first (start time, then id), with keyset paging so older
 * swims load without gaps or repeats. Pass the returned `nextCursor` to get the next page.
 */
export async function listMySwims(
  userId: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<MySwimsPage> {
  const { cursor, limit } = pageOptions.parse(options);
  const after = cursor ? decodeCursor(cursor) : null;
  const rows = await db.swim.findMany({
    where: {
      userId,
      ...(after && {
        OR: [
          { startedAt: { lt: after.startedAt } },
          { startedAt: after.startedAt, id: { lt: after.id } },
        ],
      }),
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, startedAt: true, distanceM: true, durationS: true },
  });
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((s) => ({ ...s, startedAt: s.startedAt.toISOString() })),
    nextCursor: rows.length > limit && last ? encodeCursor(last.startedAt, last.id) : null,
  };
}

const isKnownReason = (x: StoredReason): x is ReasonCode | Reason =>
  (REASON_CODES as readonly string[]).includes(reasonCodeOf(x));

function breakdown(entries: { kind: PointsKind; points: number }[]): SwimPointsBreakdown {
  const sum = (kind: PointsKind) =>
    entries.filter((e) => e.kind === kind).reduce((n, e) => n + e.points, 0);
  return {
    distance: sum("DISTANCE"),
    firstSwimBonus: sum("FIRST_SWIM_BONUS"),
    longSwimBonus: sum("LONG_SWIM_BONUS"),
    total: entries.reduce((n, e) => n + e.points, 0),
  };
}

/**
 * One of the player's own swims with its status, reasons and points in each tournament.
 * Another player's swim (or an unknown id) is `null`, so its existence is not revealed.
 */
export async function getMySwim(userId: string, swimId: string): Promise<MySwimDto | null> {
  if (typeof swimId !== "string" || swimId.length === 0 || swimId.length > 100) return null;
  const swim = await db.swim.findFirst({
    where: { id: swimId, userId },
    include: {
      results: {
        ...swimDtoInclude.results,
        select: {
          ...swimDtoInclude.results.select,
          pointsEntries: { select: { kind: true, points: true } },
        },
      },
    },
  });
  if (!swim) return null;

  const dto = toOwnerSwimDto(swim);
  return {
    ...dto,
    results: dto.results.map((r, i) => ({
      ...r,
      displayStatus: DISPLAY_STATUS[r.status],
      reasons: r.reasons.filter(isKnownReason),
      points: breakdown(swim.results[i].pointsEntries),
    })),
  };
}
