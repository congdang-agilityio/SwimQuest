import { z } from "zod";
import { emailSchema } from "@/lib/validation/auth";
import { db } from "../db";
import { verifyPassword } from "./password";
import { createSession } from "./session";

/**
 * argon2id hash of a random, discarded secret, with the same cost as real hashes. An unknown
 * email is verified against it so the response time does not reveal whether an account exists.
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$Rfh5uTQ6/zHB1xd3aZZwyA$xhkroZVNrekKFMzZBjz4jFxeh3KXwIkAqnDTHHUeJ2g";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type LoginResult =
  | { ok: true; user: { id: string; displayName: string }; sessionToken: string }
  | { ok: false; reason: "INVALID_INPUT" | "INVALID_CREDENTIALS" };

/**
 * Signs in an ACTIVE user by email (case-insensitive) and password and creates a new session.
 * An unknown email, a wrong password and a non-active account all return INVALID_CREDENTIALS,
 * and each runs exactly one argon2 verify.
 */
export async function logIn(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, displayName: true, status: true, passwordHash: true },
  });
  const matches = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
  if (!user || !matches || user.status !== "ACTIVE") {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  const { token } = await createSession(user.id);
  return { ok: true, user: { id: user.id, displayName: user.displayName }, sessionToken: token };
}
