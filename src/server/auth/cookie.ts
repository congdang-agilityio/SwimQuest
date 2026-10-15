import type { NextResponse } from "next/server";
import { SESSION_TTL_MS } from "./session";

export const SESSION_COOKIE = "sq_session";

function options(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Puts the session token in an httpOnly cookie that lasts as long as the session (30 days). */
export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, options(Math.floor(SESSION_TTL_MS / 1000)));
  return response;
}

/** Tells the browser to drop the session cookie. */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", options(0));
  return response;
}
