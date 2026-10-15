import { Prisma } from "@prisma/client";
import { parseSignUp, type SignUpErrors } from "@/lib/validation/auth";
import { db } from "../db";
import { hashPassword } from "./password";
import { newSessionData, publicUserSelect } from "./session";

type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export type SignUpResult =
  { ok: true; user: PublicUser; sessionToken: string } | { ok: false; errors: SignUpErrors };

/**
 * Creates an ACTIVE user (no email verification, Q-01) with an argon2id password hash and a
 * first session, in one write. An email that is already used returns EMAIL_TAKEN, also when
 * two sign-ups race (the unique index decides).
 */
export async function signUp(input: unknown): Promise<SignUpResult> {
  const parsed = parseSignUp(input);
  if (!parsed.ok) return parsed;
  const { email, password, displayName } = parsed.data;

  const passwordHash = await hashPassword(password);
  const { token, data: session } = newSessionData();
  try {
    const user = await db.user.create({
      data: { email, passwordHash, displayName, status: "ACTIVE", sessions: { create: session } },
      select: publicUserSelect,
    });
    return { ok: true, user, sessionToken: token };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, errors: { email: "EMAIL_TAKEN" } };
    }
    throw error;
  }
}
