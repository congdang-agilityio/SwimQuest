import { NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth/cookie";
import { logIn } from "@/server/auth/login";
import { apiError } from "@/server/http/api-error";
import { isLocale, setLocaleCookie } from "@/server/profile/locale";
import { isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login: signs an active user in with a new session cookie. Every credential
 * failure (unknown email, wrong password, non-active account) gets the same 401 body.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");

  const result = await logIn(json.body);
  if (!result.ok) {
    if (result.reason === "INVALID_INPUT") return apiError(400, "VALIDATION_FAILED");
    return apiError(401, "INVALID_CREDENTIALS");
  }

  const response = NextResponse.json(
    { user: result.user },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
  if (isLocale(result.locale)) setLocaleCookie(response, result.locale);
  return setSessionCookie(response, result.sessionToken);
}
