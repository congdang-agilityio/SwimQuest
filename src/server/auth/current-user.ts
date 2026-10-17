import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { safeNextPath, WELCOME_PATH } from "@/lib/auth/public-paths";
import { apiError } from "../http/api-error";
import { SESSION_COOKIE } from "./cookie";
import { deleteSession, resolveSession } from "./session";

/**
 * `mustChangePassword`: an admin set a temporary password (S-59 AC 3); until the user picks a
 * new one, pages redirect to `NEW_PASSWORD_PATH` and APIs answer 403 `PASSWORD_CHANGE_REQUIRED`.
 */
export type CurrentUser = {
  id: string;
  displayName: string;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
};

/** The only page a user with a temporary password may open. */
export const NEW_PASSWORD_PATH = "/account/new-password";

type SessionLookup =
  { kind: "user"; user: CurrentUser } | { kind: "suspended"; token: string } | { kind: "none" };

async function lookUpSession(): Promise<SessionLookup> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "none" };
  const found = await resolveSession(token);
  if (!found) return { kind: "none" };
  if ("suspended" in found) return { kind: "suspended", token };
  const { id, displayName, isPlatformAdmin, mustChangePassword } = found.user;
  return { kind: "user", user: { id, displayName, isPlatformAdmin, mustChangePassword } };
}

/**
 * The signed-in user from the session cookie, or null when there is no valid session: no
 * cookie, an unknown or malformed token, an expired session, or a user who is not ACTIVE.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const found = await lookUpSession();
  return found.kind === "user" ? found.user : null;
}

/** The path part of a `next` value (no query or hash); "/" when it is not a safe path. */
function pathOf(nextPath: string): string {
  return new URL(safeNextPath(nextPath), "http://same.site").pathname;
}

/**
 * For pages: the signed-in user, or a redirect to `/login?next=<nextPath>`; at the bare main
 * address (`/`, no query) an expired or unknown session counts as signed out and goes to the
 * welcome page. A suspended user's session is deleted and they are sent to
 * `/login?suspended=1`. A user with a temporary password is sent to `NEW_PASSWORD_PATH` from
 * any other page.
 */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const found = await lookUpSession();
  if (found.kind === "suspended") {
    await deleteSession(found.token);
    redirect("/login?suspended=1");
  }
  if (found.kind === "none") {
    if (nextPath === "/") redirect(WELCOME_PATH);
    redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  }
  if (found.user.mustChangePassword && pathOf(nextPath) !== NEW_PASSWORD_PATH) {
    redirect(NEW_PASSWORD_PATH);
  }
  return found.user;
}

/**
 * For API routes: the signed-in user, or a response to return: 401 `UNAUTHENTICATED` without a
 * valid session, 403 `ACCOUNT_SUSPENDED` for a suspended user, 403 `PASSWORD_CHANGE_REQUIRED`
 * while the user has a temporary password. `PUT /api/me/password` and logout do not use this
 * guard, so they stay open to that user.
 */
export async function requireApiUser(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const found = await lookUpSession();
  if (found.kind === "suspended")
    return { ok: false, response: apiError(403, "ACCOUNT_SUSPENDED") };
  if (found.kind === "none") return { ok: false, response: apiError(401, "UNAUTHENTICATED") };
  if (found.user.mustChangePassword)
    return { ok: false, response: apiError(403, "PASSWORD_CHANGE_REQUIRED") };
  return { ok: true, user: found.user };
}
