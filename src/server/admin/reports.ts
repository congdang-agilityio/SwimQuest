import { z } from "zod";
import type { ReportStatus, ReportTargetType } from "@prisma/client";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { NotFoundError, requirePlatformAdmin } from "@/server/auth/roles";
import type { AdminActor } from "./users";

export const REPORTS_PAGE_SIZE = 50;
const NOTE_MAX = 500;

/** A refused report action: 400 for bad input, 409 when the report is already closed. */
export class ReportError extends Error {
  readonly status: 400 | 409;
  constructor(readonly code: "INVALID_STATUS" | "REASON_REQUIRED" | "ALREADY_DECIDED") {
    super(code);
    this.status = code === "ALREADY_DECIDED" ? 409 : 400;
  }
}

const listStatusSchema = z.enum(["OPEN", "HANDLED", "DISMISSED"]).optional();
const closeStatusSchema = z.enum(["HANDLED", "DISMISSED"]);
const noteSchema = z.string().trim().min(1).max(NOTE_MAX);

/** Refuses unless the caller is an active platform admin right now, per the database. */
async function requireAdmin(client: Pick<typeof db, "user">, actor: AdminActor): Promise<string> {
  const id = typeof actor?.id === "string" ? actor.id : "";
  const user = id ? await client.user.findUnique({ where: { id } }) : null;
  requirePlatformAdmin(user?.status === "ACTIVE" ? user : null);
  return id;
}

type Target = {
  type: ReportTargetType;
  id: string;
  label: string | null;
  tournamentId: string | null;
};

/** Names of the reported rows, one query per target type; a deleted target gives a null label. */
async function resolveTargets(
  rows: { targetType: ReportTargetType; targetId: string }[],
): Promise<Map<string, Pick<Target, "label" | "tournamentId">>> {
  const ids = (type: ReportTargetType) => [
    ...new Set(rows.filter((r) => r.targetType === type).map((r) => r.targetId)),
  ];
  const [players, teams, tournaments, swims] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids("PLAYER") } },
      select: { id: true, displayName: true },
    }),
    db.team.findMany({
      where: { id: { in: ids("TEAM") } },
      select: { id: true, name: true, tournamentId: true },
    }),
    db.tournament.findMany({
      where: { id: { in: ids("TOURNAMENT") } },
      select: { id: true, name: true },
    }),
    db.swim.findMany({ where: { id: { in: ids("SWIM") } }, select: { id: true } }),
  ]);
  const map = new Map<string, Pick<Target, "label" | "tournamentId">>();
  for (const p of players) map.set(`PLAYER:${p.id}`, { label: p.displayName, tournamentId: null });
  for (const t of teams) map.set(`TEAM:${t.id}`, { label: t.name, tournamentId: t.tournamentId });
  for (const t of tournaments) map.set(`TOURNAMENT:${t.id}`, { label: t.name, tournamentId: t.id });
  for (const s of swims) map.set(`SWIM:${s.id}`, { label: null, tournamentId: null });
  return map;
}

/**
 * Reports for the admin queue (S-72 AC 1): open ones first, then newest first, at most
 * `REPORTS_PAGE_SIZE` per page; pass `nextCursor` back as `cursor`. The reporter (public name
 * plus email, for contact) is returned to admins only and never leaves this module otherwise.
 */
export async function listReports(admin: AdminActor, status?: string, cursor?: string) {
  await requireAdmin(db, admin);
  const parsed = listStatusSchema.safeParse(status || undefined);
  if (!parsed.success) throw new ReportError("INVALID_STATUS");
  const rows = await db.report.findMany({
    where: parsed.data ? { status: parsed.data } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    take: REPORTS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      reporter: { select: { id: true, displayName: true, email: true } },
      handledBy: { select: { id: true, displayName: true } },
    },
  });
  const page = rows.slice(0, REPORTS_PAGE_SIZE);
  const targets = await resolveTargets(page);
  return {
    reports: page.map((r) => ({
      id: r.id,
      target: {
        type: r.targetType,
        id: r.targetId,
        ...(targets.get(`${r.targetType}:${r.targetId}`) ?? { label: null, tournamentId: null }),
      },
      text: r.text,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt,
      handledAt: r.handledAt,
      handledBy: r.handledBy,
      reporter: r.reporter,
    })),
    nextCursor: rows.length > REPORTS_PAGE_SIZE ? page[page.length - 1].id : null,
  };
}

/**
 * Closes an open report as handled or dismissed with an internal note (S-72 AC 2), audited as
 * `REPORT_CLOSED` in the same transaction. A closed report gives `ALREADY_DECIDED` (409).
 */
export async function closeReport(admin: AdminActor, id: string, status: string, note: string) {
  const to = closeStatusSchema.safeParse(status);
  if (!to.success) throw new ReportError("INVALID_STATUS");
  const text = noteSchema.safeParse(note);
  if (!text.success) throw new ReportError("REASON_REQUIRED");
  return db.$transaction(async (tx) => {
    const adminId = await requireAdmin(tx, admin);
    const [report] = await tx.$queryRaw<{ status: ReportStatus }[]>`
      SELECT "status" FROM "Report" WHERE "id" = ${String(id)} FOR UPDATE`;
    if (!report) throw new NotFoundError();
    if (report.status !== "OPEN") throw new ReportError("ALREADY_DECIDED");
    const closed = await tx.report.update({
      where: { id },
      data: { status: to.data, note: text.data, handledById: adminId, handledAt: new Date() },
      select: { id: true, status: true, note: true, handledAt: true },
    });
    await recordAudit(tx, {
      actor: { type: "USER", userId: adminId },
      action: AUDIT_ACTIONS.REPORT_CLOSED,
      entityType: "Report",
      entityId: id,
      before: { status: "OPEN" },
      after: { status: to.data },
      reason: text.data,
    });
    return closed;
  });
}
