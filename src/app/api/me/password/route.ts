import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { changePassword, type ChangePasswordInput } from "@/server/auth/change-password";
import { SESSION_COOKIE } from "@/server/auth/cookie";
import { findValidSession } from "@/server/auth/session";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";

/**
 * PUT /api/me/password `{ current, next, confirm }`: changes the signed-in user's password.
 * 200 `{ ok: true }`; field errors are 400 `VALIDATION_FAILED` with `fields`; signed out is 401.
 * This session stays signed in, every other session is revoked. The body is never logged.
 */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const found = token ? await findValidSession(token) : null;
  if (!found) return apiError(401, "UNAUTHENTICATED");
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null) {
    return apiError(400, "INVALID_BODY");
  }
  const input = json.body as ChangePasswordInput;
  const result = await changePassword(found.user.id, found.session.id, input);
  if (!result.ok) return apiError(400, "VALIDATION_FAILED", result.errors);
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
