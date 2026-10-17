import { createHash, randomBytes } from "node:crypto";
import { db } from "../db";

/** Proposed session length: 30 days from sign-in. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;
/** 32 random bytes in base64url, no padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  isPlatformAdmin: true,
} as const;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * A new random token and the row data to store for it. Only the SHA-256 hash of the token
 * is stored; the token itself goes to the client once and is never logged.
 */
export function newSessionData(now: Date = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  return { token, data: { tokenHash: hashToken(token), expiresAt, lastSeenAt: now } };
}

export async function createSession(userId: string, now: Date = new Date()) {
  const { token, data } = newSessionData(now);
  await db.session.create({ data: { ...data, userId } });
  return { token, expiresAt: data.expiresAt };
}

/**
 * The session and its user for `token`, or null when the token is unknown or malformed, the
 * session has expired, or the user is not ACTIVE. Refreshes `lastSeenAt` at most once per hour.
 */
export async function findValidSession(token: string, now: Date = new Date()) {
  const found = await resolveSession(token, now);
  return !found || "suspended" in found ? null : found;
}

/**
 * Like `findValidSession`, but tells a live session of a SUSPENDED user apart from no session:
 * `{ suspended: true }` then, so guards can refuse with ACCOUNT_SUSPENDED instead of a login.
 */
export async function resolveSession(token: string, now: Date = new Date()) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, user: { select: publicUserSelect } },
  });
  if (!session || session.expiresAt <= now) return null;
  if (session.user.status === "SUSPENDED") return { suspended: true as const };
  if (session.user.status !== "ACTIVE") return null;

  const staleBefore = new Date(now.getTime() - LAST_SEEN_REFRESH_MS);
  await db.session.updateMany({
    where: { id: session.id, lastSeenAt: { lte: staleBefore } },
    data: { lastSeenAt: now },
  });
  const { user, ...rest } = session;
  return { session: rest, user };
}

/** Deletes the session for `token`; unknown tokens are ignored. */
export async function deleteSession(token: string): Promise<void> {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
