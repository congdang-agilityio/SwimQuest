import { passwordSchema, type SignUpErrorCode } from "@/lib/validation/auth";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { db } from "../db";
import { DUMMY_PASSWORD_HASH } from "./login";
import { hashPassword, verifyPassword } from "./password";

export type ChangePasswordInput = { current: string; next: string; confirm: string };

/** The sign-up password codes (same rule as sign-up), shown on the new-password field. */
export type NewPasswordErrorCode = Extract<SignUpErrorCode, `PASSWORD_${string}`>;

export type ChangePasswordErrors = {
  current?: "WRONG_PASSWORD";
  next?: NewPasswordErrorCode;
  confirm?: "PASSWORD_MISMATCH";
};

export type ChangePasswordResult = { ok: true } | { ok: false; errors: ChangePasswordErrors };

const asString = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Changes the password of an ACTIVE user who proves the current one. The new password follows
 * the sign-up rule and must be entered twice. On success, in one transaction: the new argon2id
 * hash is stored, `mustChangePassword` is cleared, every other session of the user is deleted
 * (`currentSessionId` stays) and PASSWORD_CHANGED is audited without any password or hash.
 * Runs exactly one argon2 verify, also for an unknown or inactive user.
 */
export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  const raw = typeof input === "object" && input !== null ? input : ({} as ChangePasswordInput);
  const current = asString(raw.current);
  const errors: ChangePasswordErrors = {};

  const next = passwordSchema.safeParse(raw.next);
  if (!next.success) errors.next = next.error.issues[0].message as NewPasswordErrorCode;
  else if (raw.confirm !== next.data) errors.confirm = "PASSWORD_MISMATCH";

  const user =
    typeof userId === "string" && userId.length > 0 && userId.length <= 100
      ? await db.user.findUnique({
          where: { id: userId },
          select: { status: true, passwordHash: true, mustChangePassword: true },
        })
      : null;
  const matches =
    current.length > 0 &&
    current.length <= 128 &&
    (await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, current));
  if (!user || user.status !== "ACTIVE" || !matches) errors.current = "WRONG_PASSWORD";

  if (!user || !next.success || errors.current || errors.confirm) return { ok: false, errors };

  const passwordHash = await hashPassword(next.data);
  const changed = await db.$transaction(async (tx) => {
    // Only if the password was not changed in the meantime (the verified hash is still stored).
    const updated = await tx.user.updateMany({
      where: { id: userId, status: "ACTIVE", passwordHash: user.passwordHash },
      data: { passwordHash, mustChangePassword: false },
    });
    if (updated.count !== 1) return false;
    const revoked = await tx.session.deleteMany({
      where: { userId, id: { not: asString(currentSessionId) } },
    });
    await recordAudit(tx, {
      actor: { type: "USER", userId },
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: "User",
      entityId: userId,
      before: { mustChangePassword: user.mustChangePassword },
      after: { mustChangePassword: false, otherSessionsRevoked: revoked.count },
    });
    return true;
  });
  return changed ? { ok: true } : { ok: false, errors: { current: "WRONG_PASSWORD" } };
}
