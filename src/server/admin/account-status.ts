import { z } from "zod";
import type { UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, type AuditAction, recordAudit } from "@/server/audit/record";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import type { AdminActor } from "./users";

/** The reason is missing, blank or longer than 500 characters. */
export class ReasonRequiredError extends Error {
  readonly status = 400;
  readonly code = "REASON_REQUIRED";
}

/** An admin tried to suspend their own account. */
export class CannotSuspendSelfError extends Error {
  readonly status = 409;
  readonly code = "CANNOT_SUSPEND_SELF";
}

/** The account is not in the state the change starts from. */
export class InvalidAccountStateError extends Error {
  readonly status = 409;
  readonly code = "INVALID_STATE";
}

export type AccountStatusResult = { id: string; status: UserStatus };

const reasonSchema = z.string().trim().min(1).max(500);
const userIdSchema = z.string().min(1).max(100);

type Change = { from: UserStatus; to: UserStatus; action: AuditAction; endSessions: boolean };

/**
 * Moves one account from `from` to `to` for an active platform admin (role re-read from the
 * locked admin rows), in one transaction with its audit event. Swims, points, XP and team
 * memberships are never touched.
 */
async function changeStatus(
  actor: AdminActor,
  targetId: string,
  rawReason: string,
  change: Change,
): Promise<AccountStatusResult> {
  return db.$transaction(async (tx) => {
    // Lock every admin row in id order first (as setPlatformAdmin does), then check the caller
    // against that locked set: admin-state changes serialize on the same rows, so two admins
    // suspending each other at once cannot leave the platform without an active admin.
    const admins = await tx.$queryRaw<{ id: string; status: UserStatus }[]>`
      SELECT "id", "status" FROM "User" WHERE "isPlatformAdmin" = true ORDER BY "id" FOR UPDATE`;
    const actorId = typeof actor?.id === "string" ? actor.id : "";
    const caller = admins.find((a) => a.id === actorId && a.status === "ACTIVE");
    if (!caller) throw new ForbiddenError();

    const reason = reasonSchema.safeParse(rawReason);
    if (!reason.success) throw new ReasonRequiredError();
    const id = userIdSchema.safeParse(targetId);
    if (!id.success) throw new NotFoundError();
    if (change.endSessions && id.data === actorId) throw new CannotSuspendSelfError();

    // Lock the target row so concurrent changes see one consistent state.
    const [target] = await tx.$queryRaw<{ id: string; status: UserStatus }[]>`
      SELECT "id", "status" FROM "User" WHERE "id" = ${id.data} FOR UPDATE`;
    if (!target) throw new NotFoundError();
    if (target.status !== change.from) throw new InvalidAccountStateError();

    await tx.user.update({ where: { id: target.id }, data: { status: change.to } });
    if (change.endSessions) await tx.session.deleteMany({ where: { userId: target.id } });
    await recordAudit(tx, {
      actor: { type: "USER", userId: actorId },
      action: change.action,
      entityType: "User",
      entityId: target.id,
      before: { status: change.from },
      after: { status: change.to },
      reason: reason.data,
    });
    return { id: target.id, status: change.to };
  });
}

/**
 * Suspends an active account with a reason (S-63 AC 1): all its sessions end at once, audited
 * as `ACCOUNT_SUSPENDED`. Admins cannot suspend themselves (`CannotSuspendSelfError`); a
 * non-active account gives `InvalidAccountStateError`.
 */
export function suspendUser(
  actor: AdminActor,
  targetId: string,
  reason: string,
): Promise<AccountStatusResult> {
  return changeStatus(actor, targetId, reason, {
    from: "ACTIVE",
    to: "SUSPENDED",
    action: AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
    endSessions: true,
  });
}

/**
 * Reactivates a suspended account with a reason (S-63 AC 4), audited as
 * `ACCOUNT_REACTIVATED`. Any other state gives `InvalidAccountStateError`.
 */
export function reactivateUser(
  actor: AdminActor,
  targetId: string,
  reason: string,
): Promise<AccountStatusResult> {
  return changeStatus(actor, targetId, reason, {
    from: "SUSPENDED",
    to: "ACTIVE",
    action: AUDIT_ACTIONS.ACCOUNT_REACTIVATED,
    endSessions: false,
  });
}
