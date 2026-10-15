import { NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth/cookie";
import { signUp } from "@/server/auth/signup";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";

/** POST /api/auth/signup: creates an ACTIVE account and signs it in with a session cookie. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");

  const result = await signUp(json.body);
  if (!result.ok) {
    if (result.errors.email === "EMAIL_TAKEN") return apiError(409, "EMAIL_TAKEN", result.errors);
    return apiError(400, "VALIDATION_FAILED", result.errors);
  }

  const { id, displayName } = result.user;
  const response = NextResponse.json(
    { user: { id, displayName } },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
  return setSessionCookie(response, result.sessionToken);
}
