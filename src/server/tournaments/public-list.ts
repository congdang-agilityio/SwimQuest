import { Prisma } from "@prisma/client";
import { effectiveStatus, type TournamentStatus } from "@/lib/tournaments/lifecycle";
import { db } from "@/server/db";

export type PublicListStatus = "PUBLISHED" | "ACTIVE" | "COMPLETED";

export type PublicTournamentItem = {
  id: string;
  name: string;
  seasonStartAt: Date;
  seasonEndAt: Date;
  status: PublicListStatus;
  freePlaces: number;
};

export type PublicTournamentPage = { items: PublicTournamentItem[]; nextCursor: string | null };

export const PUBLIC_PAGE_SIZE = 20;
const LISTABLE: PublicListStatus[] = ["PUBLISHED", "ACTIVE", "COMPLETED"];
const DEFAULT_STATUSES: PublicListStatus[] = ["PUBLISHED", "ACTIVE"];
const MAX_QUERY_LENGTH = 100;

/** Case- and accent-insensitive form: "Lý Sơn" -> "ly son" (đ folds to d). */
export function foldName(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/** translate() maps for Postgres: every Vietnamese accented letter (both cases) to its base. */
const COMBINING = ["̀", "́", "̃", "̉", "̣", "̂", "̆", "̛"];
const [FOLD_FROM, FOLD_TO] = (() => {
  const from: string[] = ["đ", "Đ"];
  const to: string[] = ["d", "D"];
  for (const base of "aăâeêioôơuưy") {
    for (const tone of ["", ...COMBINING.slice(0, 5)]) {
      for (const ch of [
        (base + tone).normalize("NFC"),
        (base + tone).normalize("NFC").toUpperCase(),
      ]) {
        const plain = ch.normalize("NFD").replace(/\p{M}/gu, "");
        if (ch.length === 1 && plain !== ch && !from.includes(ch)) {
          from.push(ch);
          to.push(plain);
        }
      }
    }
  }
  // Decomposed (NFD) names: combining marks have no counterpart, so translate() drops them.
  return [from.join("") + COMBINING.join(""), to.join("")];
})();

function parseStatus(status: unknown): PublicListStatus[] {
  const value = typeof status === "string" ? status.toUpperCase() : "";
  return LISTABLE.includes(value as PublicListStatus)
    ? [value as PublicListStatus]
    : DEFAULT_STATUSES;
}

function encodeCursor(item: PublicTournamentItem): string {
  return Buffer.from(JSON.stringify([item.seasonStartAt.toISOString(), item.id])).toString(
    "base64url",
  );
}

/** An invalid cursor is ignored (first page), never an error. */
function decodeCursor(cursor: unknown): { startAt: Date; id: string } | null {
  if (typeof cursor !== "string" || cursor.length === 0 || cursor.length > 200) return null;
  try {
    const [iso, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown[];
    const startAt = new Date(String(iso));
    if (typeof id !== "string" || Number.isNaN(startAt.getTime())) return null;
    return { startAt, id };
  } catch {
    return null;
  }
}

/**
 * Public tournament search (story S-31, FR-27/FR-28). Lists only `visibility = PUBLIC`
 * tournaments whose effective status is in the filter (default published and active); drafts,
 * invite-only (or unset) and archived tournaments never appear, whoever asks. The name search
 * is case- and accent-insensitive. Ordered by season start, 20 per page with a keyset cursor.
 */
export async function searchPublicTournaments(
  { q, status, cursor }: { q?: unknown; status?: unknown; cursor?: unknown },
  now: Date = new Date(),
): Promise<PublicTournamentPage> {
  const statuses = parseStatus(status);
  const term = typeof q === "string" ? foldName(q.trim()).slice(0, MAX_QUERY_LENGTH) : "";
  const after = decodeCursor(cursor);

  const nameClause = term
    ? Prisma.sql`AND lower(translate(t."name", ${FOLD_FROM}, ${FOLD_TO})) LIKE ${`%${term.replace(/[\\%_]/g, "\\$&")}%`} ESCAPE '\\'`
    : Prisma.empty;
  const cursorClause = after
    ? Prisma.sql`AND (t."seasonStartAt", t."id") > (${after.startAt}, ${after.id})`
    : Prisma.empty;

  // The CASE mirrors effectiveStatus() in src/lib/tournaments/lifecycle.ts.
  const rows = await db.$queryRaw<
    {
      id: string;
      name: string;
      seasonStartAt: Date;
      seasonEndAt: Date;
      stored: string;
      freePlaces: number;
    }[]
  >`
    WITH page AS (
      SELECT * FROM (
        SELECT t."id", t."name", t."seasonStartAt", t."seasonEndAt", t."status"::text AS "stored",
          CASE
            WHEN ${now} >= t."seasonEndAt" THEN 'COMPLETED'
            WHEN t."status" = 'PUBLISHED' AND ${now} >= t."seasonStartAt" THEN 'ACTIVE'
            ELSE t."status"::text
          END AS "effective"
        FROM "Tournament" t
        WHERE t."visibility" = 'PUBLIC'
          AND t."status" IN ('PUBLISHED', 'ACTIVE', 'COMPLETED')
          AND t."archivedAt" IS NULL
          ${nameClause}
          ${cursorClause}
      ) x
      WHERE x."effective" IN (${Prisma.join(statuses)})
      ORDER BY x."seasonStartAt", x."id"
      LIMIT ${PUBLIC_PAGE_SIZE + 1}
    )
    SELECT p."id", p."name", p."seasonStartAt", p."seasonEndAt", p."stored",
      COALESCE((
        SELECT SUM(GREATEST(0, tm."memberLimit" - (
          SELECT COUNT(*) FROM "TeamMember" m WHERE m."teamId" = tm."id" AND m."status" = 'ACTIVE'
        )))
        FROM "Team" tm WHERE tm."tournamentId" = p."id"
      ), 0)::int AS "freePlaces"
    FROM page p
    ORDER BY p."seasonStartAt", p."id"`;

  // Defense in depth: re-derive the status with the shared rule and drop anything outside the filter.
  const items = rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      seasonStartAt: row.seasonStartAt,
      seasonEndAt: row.seasonEndAt,
      status: effectiveStatus(
        { ...row, status: row.stored as TournamentStatus, startChoiceDeadlineAt: null },
        now,
      ) as PublicListStatus,
      freePlaces: row.freePlaces,
    }))
    .filter((item) => statuses.includes(item.status));

  const hasMore = rows.length > PUBLIC_PAGE_SIZE;
  const pageItems = items.slice(0, PUBLIC_PAGE_SIZE);
  const last = pageItems.at(-1);
  return { items: pageItems, nextCursor: hasMore && last ? encodeCursor(last) : null };
}
