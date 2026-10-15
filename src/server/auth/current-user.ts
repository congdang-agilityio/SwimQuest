import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/public-paths";
import { apiError } from "../http/api-error";
import { SESSION_COOKIE } from "./cookie";
import { findValidSession } from "./session";

export type CurrentUser = { id: string; displayName: string; isPlatformAdmin: boolean };

/**
 * The signed-in user from the session cookie, or null when there is no valid session: no
 * cookie, an unknown or malformed token, an expired session, or a user who is not ACTIVE.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const found = await findValidSession(token);
  if (!found) return null;
  const { id, displayName, isPlatformAdmin } = found.user;
  return { id, displayName, isPlatformAdmin };
}

/** For pages: the signed-in user, or a redirect to `/login?next=<nextPath>`. */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  return user;
}

/** For API routes: the signed-in user, or a 401 `UNAUTHENTICATED` response to return. */
export async function requireApiUser(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: apiError(401, "UNAUTHENTICATED") };
  return { ok: true, user };
}
