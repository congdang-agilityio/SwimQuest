import { z } from "zod";
import { Prisma, type DisputeStatus, type SwimResultStatus } from "@prisma/client";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { ForbiddenError, NotFoundError, requireReviewer } from "@/server/auth/roles";
import { lockPlayerSwims } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { emitEvent } from "@/server/events/emit";
import { onVerified } from "@/server/scoring/on-verified";
import { AlreadyDecidedError, ReasonRequiredError } from "./decide";

/** The result already has an open dispute (one per result, S-44 AC 4). */
export class DisputeOpenError extends Error {
  readonly status = 409;
  readonly code = "DISPUTE_OPEN";
}

/** Only REJECTED, DUPLICATE and RULE_MISSED results can be disputed. */
export class NotDisputableError extends Error {
  readonly status = 409;
  readonly code = "NOT_DISPUTABLE";
}

export type DisputeDecision = { accept: boolean; reason?: string };
export type DisputeDecisionResult = {
  disputeId: string;
  resultId: string;
  status: SwimResultStatus;
};

const DISPUTABLE: readonly SwimResultStatus[] = ["REJECTED", "DUPLICATE", "RULE_MISSED"];
const reasonSchema = z.string().trim().min(1).max(300);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function parseReason(reason: unknown): string {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) throw new ReasonRequiredError();
  return parsed.data;
}

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * The owner disputes one tournament's REJECTED, DUPLICATE or RULE_MISSED result (S-44 AC 1, 4):
 * the result becomes DISPUTED (it does not count, BR-04) and the dispute keeps its earlier
 * status for a rejected dispute to restore. One open dispute per result: a DISPUTED result, or
 * a raise racing another, gives DISPUTE_OPEN. The reason is required (1-300 characters after
 * trimming). Lock order as an upload: the player's `swims:<userId>` lock, then the result row.
 * Throws NotFoundError, ForbiddenError, ReasonRequiredError, NotDisputableError and
 * DisputeOpenError.
 */
export async function raiseDispute(
  userId: string,
  resultId: string,
  reason: string,
): Promise<{ disputeId: string; resultId: string }> {
  if (!isId(resultId)) throw new NotFoundError();
  const found = await db.swimResult.findUnique({
    where: { id: resultId },
    select: { userId: true },
  });
  if (!found) throw new NotFoundError();
  if (!isId(userId) || found.userId !== userId) throw new ForbiddenError();
  const text = parseReason(reason);

  try {
    return await db.$transaction(async (tx) => {
      await lockPlayerSwims(tx, userId);
      const [locked] = await tx.$queryRaw<{ status: SwimResultStatus }[]>`
        SELECT "status" FROM "SwimResult" WHERE "id" = ${resultId} FOR UPDATE`;
      if (!locked) throw new NotFoundError();
      if (locked.status === "DISPUTED") throw new DisputeOpenError();
      if (!DISPUTABLE.includes(locked.status)) throw new NotDisputableError();

      const dispute = await tx.dispute.create({
        data: { swimResultId: resultId, userId, reason: text, previousStatus: locked.status },
      });
      await tx.swimResult.update({ where: { id: resultId }, data: { status: "DISPUTED" } });
      return { disputeId: dispute.id, resultId };
    });
  } catch (err) {
    // The partial unique index allows one OPEN dispute per result.
    if (isUniqueViolation(err)) throw new DisputeOpenError();
    throw err;
  }
}

/**
 * A reviewer of the result's tournament decides one OPEN dispute with a required reason
 * (S-44 AC 2, 5). Accept makes the result VERIFIED and runs the shared `onVerified` hook
 * (points, bonuses, badges, XP, progress); reject puts back the status it had before the
 * dispute. The dispute is closed with the decider, time and note; a `DISPUTE_DECIDED` audit
 * event and a `SWIM_RESULT_CHANGED` event commit with it. Only this tournament's result
 * changes. Lock order as an upload: `swims:<userId>`, then the dispute and result rows, then
 * the locks `onVerified` takes. Throws NotFoundError, ForbiddenError, ReasonRequiredError and
 * AlreadyDecidedError (the dispute is no longer OPEN).
 */
export async function decideDispute(
  reviewerId: string,
  disputeId: string,
  decision: DisputeDecision,
  now: Date = new Date(),
): Promise<DisputeDecisionResult> {
  if (!isId(disputeId)) throw new NotFoundError();
  const found = await db.dispute.findUnique({
    where: { id: disputeId },
    select: { swimResult: { select: { tournamentId: true, userId: true } } },
  });
  if (!found) throw new NotFoundError();
  await requireReviewer(reviewerId, found.swimResult.tournamentId);
  const note = parseReason(decision?.reason);
  const accept = decision?.accept === true;

  return db.$transaction(async (tx) => {
    await lockPlayerSwims(tx, found.swimResult.userId);
    const [dispute] = await tx.$queryRaw<
      { swimResultId: string; status: DisputeStatus; previousStatus: SwimResultStatus }[]
    >`SELECT "swimResultId", "status", "previousStatus" FROM "Dispute"
      WHERE "id" = ${disputeId} FOR UPDATE`;
    if (!dispute) throw new NotFoundError();
    if (dispute.status !== "OPEN") throw new AlreadyDecidedError();
    const [locked] = await tx.$queryRaw<{ status: SwimResultStatus }[]>`
      SELECT "status" FROM "SwimResult" WHERE "id" = ${dispute.swimResultId} FOR UPDATE`;
    if (!locked) throw new NotFoundError();
    if (locked.status !== "DISPUTED") throw new AlreadyDecidedError();

    const status = accept ? "VERIFIED" : dispute.previousStatus;
    const outcome = accept ? "ACCEPTED" : "REJECTED";
    await tx.dispute.update({
      where: { id: disputeId },
      data: { status: outcome, decidedById: reviewerId, decidedAt: now, decisionNote: note },
    });
    const result = await tx.swimResult.update({
      where: { id: dispute.swimResultId },
      data: { status },
    });
    await recordAudit(tx, {
      actor: { type: "USER", userId: reviewerId },
      action: AUDIT_ACTIONS.DISPUTE_DECIDED,
      entityType: "Dispute",
      entityId: disputeId,
      tournamentId: result.tournamentId,
      before: { status: "OPEN", resultStatus: "DISPUTED" },
      after: { status: outcome, resultStatus: status },
      reason: note,
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
        previousStatus: "DISPUTED",
      },
    });
    if (accept) await onVerified(tx, result, now);
    return { disputeId, resultId: result.id, status };
  });
}
