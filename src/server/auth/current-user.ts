import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/public-paths";
import { apiError } from "../http/api-error";
import { SESSION_COOKIE } from "./cookie";
import { deleteSession, resolveSession } from "./session";

export type CurrentUser = { id: string; displayName: string; isPlatformAdmin: boolean };

type SessionLookup =
  { kind: "user"; user: CurrentUser } | { kind: "suspended"; token: string } | { kind: "none" };

async function lookUpSession(): Promise<SessionLookup> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "none" };
  const found = await resolveSession(token);
  if (!found) return { kind: "none" };
  if ("suspended" in found) return { kind: "suspended", token };
  const { id, displayName, isPlatformAdmin } = found.user;
  return { kind: "user", user: { id, displayName, isPlatformAdmin } };
}

/**
 * The signed-in user from the session cookie, or null when there is no valid session: no
 * cookie, an unknown or malformed token, an expired session, or a user who is not ACTIVE.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const found = await lookUpSession();
  return found.kind === "user" ? found.user : null;
}

/**
 * For pages: the signed-in user, or a redirect to `/login?next=<nextPath>`. A suspended user's
 * session is deleted and they are sent to `/login?suspended=1`.
 */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const found = await lookUpSession();
  if (found.kind === "suspended") {
    await deleteSession(found.token);
    redirect("/login?suspended=1");
  }
  if (found.kind === "none") {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  }
  return found.user;
}

/**
 * For API routes: the signed-in user, or a response to return: 401 `UNAUTHENTICATED` without a
 * valid session, 403 `ACCOUNT_SUSPENDED` for a suspended user.
 */
export async function requireApiUser(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const found = await lookUpSession();
  if (found.kind === "suspended")
    return { ok: false, response: apiError(403, "ACCOUNT_SUSPENDED") };
  if (found.kind === "none") return { ok: false, response: apiError(401, "UNAUTHENTICATED") };
  return { ok: true, user: found.user };
}
