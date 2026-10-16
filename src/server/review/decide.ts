import { z } from "zod";
import type { SwimResultStatus } from "@prisma/client";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { NotFoundError, requireReviewer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { onVerified } from "@/server/scoring/on-verified";

/** A reject without a reason, or with one longer than 300 characters. */
export class ReasonRequiredError extends Error {
  readonly status = 400;
  readonly code = "REASON_REQUIRED";
}

/** The result is no longer FLAGGED: someone already decided it (or it changed otherwise). */
export class AlreadyDecidedError extends Error {
  readonly status = 409;
  readonly code = "ALREADY_DECIDED";
}

export type Decision = { approve: boolean; reason?: string };
export type DecisionResult = { resultId: string; status: "VERIFIED" | "REJECTED" };

const reasonSchema = z.string().trim().min(1).max(300);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

type LockedResult = { id: string; status: SwimResultStatus };

/**
 * A reviewer of the result's tournament decides one FLAGGED result (S-43 AC 2-5). Approve makes
 * it VERIFIED and runs the shared `onVerified` hook (distance points, bonuses, badges, XP, a
 * settled week's multiplier, team progress); reject makes it REJECTED with a private
 * `decisionNote` (required, 1-300 characters after trimming). Only this tournament's result
 * changes: the same swim's results elsewhere are untouched. The row is locked, so of two
 * decisions at once only one wins. The change, its `SWIM_REVIEWED` audit event and the
 * `SWIM_RESULT_CHANGED` event commit together. Throws NotFoundError, ForbiddenError,
 * ReasonRequiredError and AlreadyDecidedError.
 */
export async function decideFlagged(
  reviewerId: string,
  resultId: string,
  decision: Decision,
  now: Date = new Date(),
): Promise<DecisionResult> {
  if (!isId(resultId)) throw new NotFoundError();
  // A result never changes tournament, so the role is checked before the transaction starts.
  const found = await db.swimResult.findUnique({
    where: { id: resultId },
    select: { tournamentId: true },
  });
  if (!found) throw new NotFoundError();
  await requireReviewer(reviewerId, found.tournamentId);

  const approve = decision?.approve === true;
  let note: string | null = null;
  if (!approve) {
    const reason = reasonSchema.safeParse(decision?.reason);
    if (!reason.success) throw new ReasonRequiredError();
    note = reason.data;
  }

  return db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<LockedResult[]>`
      SELECT "id", "status" FROM "SwimResult" WHERE "id" = ${resultId} FOR UPDATE`;
    if (!locked) throw new NotFoundError();
    if (locked.status !== "FLAGGED") throw new AlreadyDecidedError();

    const status = approve ? "VERIFIED" : "REJECTED";
    const result = await tx.swimResult.update({
      where: { id: locked.id },
      data: { status, decidedById: reviewerId, decidedAt: now, decisionNote: note },
    });
    await recordAudit(tx, {
      actor: { type: "USER", userId: reviewerId },
      action: AUDIT_ACTIONS.SWIM_REVIEWED,
      entityType: "SwimResult",
      entityId: result.id,
      tournamentId: result.tournamentId,
      before: { status: "FLAGGED" },
      after: { status },
      ...(note === null ? {} : { reason: note }),
    });
    await emitEvent(tx, {
      type: "SWIM_RESULT_CHANGED",
      payload: {
        tournamentId: result.tournamentId,
        teamId: result.teamId,
        userId: result.userId,
        resultId: result.id,
        swimId: result.swimId,
        status,
        previousStatus: "FLAGGED",
      },
    });
    if (approve) await onVerified(tx, result, now);
    return { resultId: result.id, status };
  });
}
