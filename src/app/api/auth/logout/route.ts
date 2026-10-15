import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clearSessionCookie } from "@/server/auth/cookie";
import { deleteSession } from "@/server/auth/session";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout: deletes the session row and clears the cookie; 200 even without one. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);

  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
  return clearSessionCookie(response);
}
