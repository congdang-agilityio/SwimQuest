import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, NEXT_PATH_HEADER, safeNextPath } from "./lib/auth/public-paths";
import { apiError } from "./server/http/api-error";

/**
 * Same value as `SESSION_COOKIE` in `server/auth/cookie.ts`, which cannot be imported here:
 * it pulls in the database client, and middleware runs before the database is reachable.
 */
const SESSION_COOKIE = "sq_session";

/**
 * Only checks that a session cookie is present; `requireUser()` in the `(app)` layout validates
 * it against the database. Protected responses are never cached, so the back button after
 * logout does not show protected content.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const nextPath = safeNextPath(`${pathname}${search}`);
  let response: NextResponse;
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    const headers = new Headers(request.headers);
    headers.set(NEXT_PATH_HEADER, nextPath);
    response = NextResponse.next({ request: { headers } });
  } else if (pathname === "/api" || pathname.startsWith("/api/")) {
    return apiError(401, "UNAUTHENTICATED");
  } else {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", nextPath);
    response = NextResponse.redirect(login);
  }
  response.headers.set("cache-control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
