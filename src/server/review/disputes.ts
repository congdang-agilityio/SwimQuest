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
export type DisputeOutcome = { disputeId: string; resultId: string; status: SwimResultStatus };

const DISPUTABLE: readonly SwimResultStatus[] = ["REJECTED", "DUPLICATE", "RULE_MISSED"];
const reasonSchema = z.string().trim().min(1).max(300);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function parseReason(reason: unknown): string {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) throw new ReasonRequiredError();
  return parsed.data;
}

/**
 * The owner disputes one tournament's REJECTED, DUPLICATE or RULE_MISSED result (S-44 AC 1, 4)
 * with a required reason (1-300 characters): the result becomes DISPUTED (does not count, BR-04)
 * and the dispute keeps the earlier status. One open dispute per result (DISPUTE_OPEN). Lock
 * order as an upload: the player's `swims:<userId>` lock, then the result row.
 */
export async function raiseDispute(
  userId: string,
  resultId: string,
  reason: string,
): Promise<{ disputeId: string; resultId: string }> {
  if (!isId(resultId)) throw new NotFoundError();
  const owner = (await db.swimResult.findUnique({ where: { id: resultId } }))?.userId;
  if (!owner) throw new NotFoundError();
  if (!isId(userId) || owner !== userId) throw new ForbiddenError();
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
    const unique = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (unique) throw new DisputeOpenError();
    throw err;
  }
}

/**
 * A reviewer of the result's tournament decides one OPEN dispute with a required reason
 * (S-44 AC 2, 5): accept makes the result VERIFIED and runs `onVerified`; reject restores its
 * earlier status. The dispute is closed (decider, time, note), audited as `DISPUTE_DECIDED`
 * and emits `SWIM_RESULT_CHANGED`; only this tournament's result changes. Lock order as an
 * upload: `swims:<userId>`, the dispute and result rows, then the locks `onVerified` takes.
 */
export async function decideDispute(
  reviewerId: string,
  disputeId: string,
  decision: DisputeDecision,
  now: Date = new Date(),
): Promise<DisputeOutcome> {
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
    const { tournamentId, teamId, userId, swimId } = result;
    await recordAudit(tx, {
      actor: { type: "USER", userId: reviewerId },
      action: AUDIT_ACTIONS.DISPUTE_DECIDED,
      entityType: "Dispute",
      entityId: disputeId,
      tournamentId,
      before: { status: "OPEN", resultStatus: "DISPUTED" },
      after: { status: outcome, resultStatus: status },
      reason: note,
    });
    await emitEvent(tx, {
      type: "SWIM_RESULT_CHANGED",
      payload: {
        tournamentId,
        teamId,
        userId,
        resultId: result.id,
        swimId,
        status,
        previousStatus: "DISPUTED",
      },
    });
    if (accept) await onVerified(tx, result, now);
    return { disputeId, resultId: result.id, status };
  });
}
