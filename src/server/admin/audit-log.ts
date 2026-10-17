import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError, requirePlatformAdmin } from "@/server/auth/roles";
import { vnLocalToUtc } from "@/lib/time/vn";
import type { AdminActor } from "./users";

export const AUDIT_PAGE_SIZE = 50;

export class InvalidAuditCursorError extends Error {
  readonly code = "INVALID_CURSOR";
}

const id = z.string().min(1).max(100);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filtersSchema = z.object({
  tournamentId: id.optional(),
  userId: id.optional(),
  actions: z.array(z.string().min(1).max(100)).max(50).optional(),
  /** Vietnam days, inclusive: "YYYY-MM-DD". */
  from: day.optional(),
  to: day.optional(),
});
const cursorShape = z.object({ t: z.iso.datetime(), id });

export type AuditFilters = z.input<typeof filtersSchema>;

/** One audit event as admins read it. Names only: never an email. */
export type AuditEventRow = {
  id: string;
  /** Null for system events. */
  actor: { id: string; displayName: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  /** Readable name of the target when it is a team, tournament or user that still exists. */
  targetLabel: string | null;
  tournamentId: string | null;
  createdAt: string;
  reason: string | null;
};
export type AuditEventDetail = AuditEventRow & { before: unknown; after: unknown };
export type AuditEventsPage = { items: AuditEventRow[]; nextCursor: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireAdmin(actor: AdminActor): Promise<void> {
  const uid = typeof actor?.id === "string" ? actor.id : "";
  const user = uid ? await db.user.findUnique({ where: { id: uid } }) : null;
  requirePlatformAdmin(user?.status === "ACTIVE" ? user : null);
}

function encodeCursor(createdAt: Date, eventId: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), id: eventId })).toString(
    "base64url",
  );
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const { t, id: eventId } = cursorShape.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString()),
    );
    return { createdAt: new Date(t), id: eventId };
  } catch {
    throw new InvalidAuditCursorError();
  }
}

type Row = Prisma.AuditEventGetPayload<{
  include: { actor: { select: { id: true; displayName: true } } };
}>;

/** Display names for team, tournament and user targets, one query per type. */
async function targetLabels(rows: Row[]): Promise<Map<string, string>> {
  const ids = (type: string) => [
    ...new Set(rows.filter((r) => r.entityType === type).map((r) => r.entityId)),
  ];
  const [teams, tournaments, users] = await Promise.all([
    db.team.findMany({ where: { id: { in: ids("TEAM") } }, select: { id: true, name: true } }),
    db.tournament.findMany({
      where: { id: { in: ids("TOURNAMENT") } },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: { id: { in: ids("USER") } },
      select: { id: true, displayName: true },
    }),
  ]);
  const labels = new Map<string, string>();
  for (const t of teams) labels.set(`TEAM:${t.id}`, t.name);
  for (const t of tournaments) labels.set(`TOURNAMENT:${t.id}`, t.name);
  for (const u of users) labels.set(`USER:${u.id}`, u.displayName);
  return labels;
}

function toRow(r: Row, labels: Map<string, string>): AuditEventRow {
  return {
    id: r.id,
    actor: r.actor ? { id: r.actor.id, displayName: r.actor.displayName } : null,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    targetLabel: labels.get(`${r.entityType}:${r.entityId}`) ?? null,
    tournamentId: r.tournamentId,
    createdAt: r.createdAt.toISOString(),
    reason: r.reason,
  };
}

const include = { actor: { select: { id: true, displayName: true } } } as const;

/** Audit events newest first, 50 per page. Filters combine; pass `nextCursor` for the next page. */
export async function listAuditEvents(
  admin: AdminActor,
  filters: AuditFilters = {},
  cursor?: string,
): Promise<AuditEventsPage> {
  await requireAdmin(admin);
  const f = filtersSchema.parse(filters);
  const after = cursor ? decodeCursor(cursor) : null;
  const and: Prisma.AuditEventWhereInput[] = [];
  if (f.tournamentId) and.push({ tournamentId: f.tournamentId });
  if (f.userId) {
    and.push({
      OR: [{ actorUserId: f.userId }, { entityType: "USER", entityId: f.userId }],
    });
  }
  if (f.actions?.length) and.push({ action: { in: f.actions } });
  if (f.from) and.push({ createdAt: { gte: vnLocalToUtc(f.from, "00:00") } });
  if (f.to) {
    and.push({ createdAt: { lt: new Date(vnLocalToUtc(f.to, "00:00").getTime() + DAY_MS) } });
  }
  if (after) {
    and.push({
      OR: [
        { createdAt: { lt: after.createdAt } },
        { createdAt: after.createdAt, id: { lt: after.id } },
      ],
    });
  }
  const rows = await db.auditEvent.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AUDIT_PAGE_SIZE + 1,
    include,
  });
  const page = rows.slice(0, AUDIT_PAGE_SIZE);
  const last = page.at(-1);
  const labels = await targetLabels(page);
  return {
    items: page.map((r) => toRow(r, labels)),
    nextCursor:
      rows.length > AUDIT_PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

/** One audit event with its old and new values; `NotFoundError` for an unknown id. */
export async function getAuditEvent(admin: AdminActor, eventId: string): Promise<AuditEventDetail> {
  await requireAdmin(admin);
  const parsed = id.safeParse(eventId);
  const row = parsed.success
    ? await db.auditEvent.findUnique({ where: { id: parsed.data }, include })
    : null;
  if (!row) throw new NotFoundError();
  const labels = await targetLabels([row]);
  return { ...toRow(row, labels), before: row.before ?? null, after: row.after ?? null };
}

/** The distinct action names present in the log, for the action filter. */
export async function listAuditActions(admin: AdminActor): Promise<string[]> {
  await requireAdmin(admin);
  const rows = await db.auditEvent.findMany({
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
  });
  return rows.map((r) => r.action);
}
