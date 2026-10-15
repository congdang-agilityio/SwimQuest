import { NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth/cookie";
import { signUp } from "@/server/auth/signup";
import { apiError } from "@/server/http/api-error";

export const dynamic = "force-dynamic";

/** False for cross-site browser requests: a foreign or opaque Origin, or Sec-Fetch-Site. */
function isSameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwarded || request.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    return originHost === (host ?? new URL(request.url).host);
  } catch {
    return false;
  }
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.split(";")[0].trim().toLowerCase() !== "application/json") return { ok: false };
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

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
