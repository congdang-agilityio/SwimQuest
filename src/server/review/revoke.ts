import { z } from "zod";
import type { SwimResultStatus } from "@prisma/client";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { reevaluatePersonalBadges } from "@/server/badges/personal-rules";
import { ForbiddenError, NotFoundError, requireReviewer } from "@/server/auth/roles";
import { lockPlayerSwims, type Tx } from "@/server/checks/run-checks";
import { vnWeekStart } from "@/lib/time/vn";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { updateTeamProgress } from "@/server/progress/update-team-progress";
import { lockPlayerPoints } from "@/server/scoring/award-distance-points";
import { recalculatePlayerWeek } from "@/server/scoring/settle-week";
import { syncSwimXp } from "@/server/xp/sync-swim-xp";
import { ReasonRequiredError } from "./decide";

/** Only a VERIFIED result can be revoked (a revoked one cannot be revoked again). */
export class NotRevokableError extends Error {
  readonly status = 409;
  readonly code = "NOT_REVOKABLE";
}

export type RevokeOptions = { asAdmin?: boolean; now?: Date };
export type RevokeResult = { resultId: string; status: "REVOKED" };

const reasonSchema = z.string().trim().min(1).max(300);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

type LockedResult = { id: string; status: SwimResultStatus };

/** Only a platform admin (role read from the database) may use the `asAdmin` override (S-72). */
async function requireAdmin(actorId: string): Promise<void> {
  const actor = isId(actorId) && (await db.user.findUnique({ where: { id: actorId } }));
  if (!actor || !actor.isPlatformAdmin) throw new ForbiddenError();
}

/**
 * Nets out every points entry of the result with one REVERSAL entry (FR-47, BR-27): the ledger
 * is append-only and (swimResultId, kind) is unique, so the one REVERSAL row carries the negative
 * sum of the points and counted metres (bonuses count 0 m). Earlier entries are untouched.
 * Returns the team the entries count for, or null when there was nothing to reverse.
 */
async function reversePoints(tx: Tx, resultId: string, tournamentId: string, userId: string) {
  await lockPlayerPoints(tx, tournamentId, userId);
  const entries = await tx.pointsEntry.findMany({
    where: { swimResultId: resultId },
    orderBy: { createdAt: "asc" },
  });
  if (entries.length === 0 || entries.some((e) => e.kind === "REVERSAL")) return null;
  const [first] = entries;
  await tx.pointsEntry.create({
    data: {
      tournamentId,
      userId,
      teamId: first.teamId,
      swimResultId: resultId,
      kind: "REVERSAL",
      points: -entries.reduce((n, e) => n + e.points, 0),
      countedM: -entries.reduce((n, e) => n + e.countedM, 0),
      vnDay: first.vnDay,
    },
  });
  return first.teamId;
}

/**
 * A reviewer of the result's tournament (or a platform admin with `asAdmin`) revokes one VERIFIED
 * result with a reason (S-46, 1-300 characters after trimming). In one transaction: the result
 * becomes REVOKED with the reason as `decisionNote`; one REVERSAL entry removes its points and
 * bonuses; a settled week's multiplier is recalculated (#219); personal badges whose rule no
 * longer holds are removed (#307); the swim's XP is removed when it counts in no other tournament
 * (#284); each changed team's progress is refreshed in ascending order and may lose its finish
 * (SWIM_REVOKED); `SWIM_REVOKED` is audited and `SWIM_RESULT_CHANGED` emitted. The same swim's
 * results in other tournaments are untouched.
 * Lock order as `decideFlagged`: the player's `swims:<userId>` lock, the result row, points,
 * badges, XP, then team rows. Throws NotFoundError, ForbiddenError, ReasonRequiredError and
 * NotRevokableError.
 */
export async function revokeResult(
  actorId: string,
  resultId: string,
  reason: string,
  { asAdmin = false, now = new Date() }: RevokeOptions = {},
): Promise<RevokeResult> {
  if (!isId(resultId)) throw new NotFoundError();
  const found = await db.swimResult.findUnique({
    where: { id: resultId },
    select: { tournamentId: true, userId: true },
  });
  if (!found) throw new NotFoundError();
  if (asAdmin) await requireAdmin(actorId);
  else await requireReviewer(actorId, found.tournamentId, { write: true });
  const note = reasonSchema.safeParse(reason);
  if (!note.success) throw new ReasonRequiredError();

  return db.$transaction(async (tx) => {
    await lockPlayerSwims(tx, found.userId);
    const [locked] = await tx.$queryRaw<LockedResult[]>`
      SELECT "id", "status" FROM "SwimResult" WHERE "id" = ${resultId} FOR UPDATE`;
    if (!locked) throw new NotFoundError();
    if (locked.status !== "VERIFIED") throw new NotRevokableError();

    const result = await tx.swimResult.update({
      where: { id: locked.id },
      data: { status: "REVOKED", decidedById: actorId, decidedAt: now, decisionNote: note.data },
    });
    const { tournamentId, userId } = result;
    const reversedTeam = await reversePoints(tx, result.id, tournamentId, userId);
    const swim = await tx.swim.findUniqueOrThrow({ where: { id: result.swimId } });
    const week = vnWeekStart(swim.startedAt);
    const weekTeams = await recalculatePlayerWeek(tx, tournamentId, userId, week, now);
    await reevaluatePersonalBadges(tx, tournamentId, userId);
    await syncSwimXp(tx, result.swimId);
    const teams = new Set([result.teamId, ...weekTeams, ...(reversedTeam ? [reversedTeam] : [])]);
    for (const teamId of [...teams].sort()) {
      await updateTeamProgress(tx, tournamentId, teamId, now, "SWIM_REVOKED");
    }

    await recordAudit(tx, {
      actor: { type: "USER", userId: actorId },
      action: AUDIT_ACTIONS.SWIM_REVOKED,
      entityType: "SwimResult",
      entityId: result.id,
      tournamentId,
      before: { status: "VERIFIED" },
      after: { status: "REVOKED" },
      reason: note.data,
    });
    await emitEvent(tx, {
      type: "SWIM_RESULT_CHANGED",
      payload: {
        tournamentId,
        teamId: result.teamId,
        userId,
        resultId: result.id,
        swimId: result.swimId,
        status: "REVOKED",
        previousStatus: "VERIFIED",
      },
    });
    return { resultId: result.id, status: "REVOKED" };
  });
}
