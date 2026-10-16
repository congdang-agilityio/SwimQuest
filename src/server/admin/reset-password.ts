import { randomInt } from "node:crypto";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { hashPassword } from "@/server/auth/password";
import { NotFoundError, requirePlatformAdmin } from "@/server/auth/roles";
import type { AdminActor } from "./users";

export const TEMPORARY_PASSWORD_LENGTH = 12;

/** Letters and digits without look-alikes (0/O, 1/l/I), easy to read out to a player. */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random temporary password from the crypto RNG (unbiased `randomInt`). */
function temporaryPassword(): string {
  let out = "";
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const isUserId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 100;

/**
 * Sets a one-time temporary password for a player (S-59 AC 2, 4, 5), for an active platform
 * admin (role re-read from the database). The argon2id hash is computed before the transaction;
 * in one transaction (caller and target checked again) the hash is stored,
 * `mustChangePassword` is set, all of the player's sessions are deleted and
 * `PASSWORD_RESET_BY_ADMIN` is audited (admin, player, time; never the password or hash).
 * Returns the temporary password; it is not stored anywhere in clear text.
 * `ForbiddenError` for any other caller, `NotFoundError` for an unknown or deleted user.
 */
export async function resetPassword(
  actor: AdminActor,
  userId: string,
): Promise<{ temporaryPassword: string }> {
  const adminId = typeof actor?.id === "string" ? actor.id : "";
  type Client = Pick<typeof db, "user">;
  const check = async (client: Client) => {
    const admin = isUserId(adminId)
      ? await client.user.findUnique({ where: { id: adminId } })
      : null;
    requirePlatformAdmin(admin?.status === "ACTIVE" ? admin : null);
    const target = isUserId(userId)
      ? await client.user.findUnique({ where: { id: userId }, select: { id: true, status: true } })
      : null;
    if (!target || target.status === "DELETED") throw new NotFoundError();
    return target;
  };

  // Check first, then hash outside the transaction (argon2id is slow), then re-check inside it.
  await check(db);
  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  return db.$transaction(async (tx) => {
    const target = await check(tx);
    await tx.user.update({
      where: { id: target.id },
      data: { passwordHash, mustChangePassword: true },
    });
    const revoked = await tx.session.deleteMany({ where: { userId: target.id } });
    await recordAudit(tx, {
      actor: { type: "USER", userId: adminId },
      action: AUDIT_ACTIONS.PASSWORD_RESET_BY_ADMIN,
      entityType: "User",
      entityId: target.id,
      after: { mustChangePassword: true, sessionsRevoked: revoked.count },
    });
    return { temporaryPassword: password };
  });
}
