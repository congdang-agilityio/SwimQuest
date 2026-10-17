import type { ReportTargetType } from "@prisma/client";
import { db } from "@/server/db";

/** Most reports one user may send per rolling 24 hours. */
export const REPORT_LIMIT = 10;
export const REPORT_TEXT_MIN = 10;
export const REPORT_TEXT_MAX = 1000;

const TARGET_TYPES: readonly ReportTargetType[] = ["PLAYER", "TEAM", "TOURNAMENT", "SWIM"];

export type CreateReportResult =
  | { ok: true }
  | { ok: false; reason: "VALIDATION"; errors: Record<string, string> }
  | { ok: false; reason: "NOT_FOUND" | "RATE_LIMITED" };

async function targetExists(type: ReportTargetType, id: string): Promise<boolean> {
  const where = { id };
  switch (type) {
    case "PLAYER":
      return (await db.user.count({ where })) > 0;
    case "TEAM":
      return (await db.team.count({ where })) > 0;
    case "TOURNAMENT":
      return (await db.tournament.count({ where })) > 0;
    case "SWIM":
      return (await db.swim.count({ where })) > 0;
  }
}

/**
 * Stores a problem report from `reporterId` (the signed-in user, never the body). Only admins
 * can read reports (S-72); the caller gets a bare confirmation so nothing about the report,
 * and nothing the reported person could see, ever exposes the reporter (NFR-07).
 */
export async function createReport(
  reporterId: string,
  input: unknown,
): Promise<CreateReportResult> {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const errors: Record<string, string> = {};
  const targetType = body.targetType;
  const targetId = body.targetId;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (typeof targetType !== "string" || !TARGET_TYPES.includes(targetType as ReportTargetType)) {
    errors.targetType = "invalid";
  }
  if (typeof targetId !== "string" || targetId.length === 0 || targetId.length > 64) {
    errors.targetId = "invalid";
  }
  if (text.length < REPORT_TEXT_MIN || text.length > REPORT_TEXT_MAX) errors.text = "length";
  if (Object.keys(errors).length > 0) return { ok: false, reason: "VALIDATION", errors };

  const type = targetType as ReportTargetType;
  const id = targetId as string;
  if (!(await targetExists(type, id))) return { ok: false, reason: "NOT_FOUND" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.report.count({ where: { reporterId, createdAt: { gte: since } } });
  if (recent >= REPORT_LIMIT) return { ok: false, reason: "RATE_LIMITED" };

  await db.report.create({ data: { reporterId, targetType: type, targetId: id, text } });
  return { ok: true };
}
