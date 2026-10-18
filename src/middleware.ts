import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicPath,
  NEXT_PATH_HEADER,
  safeNextPath,
  WELCOME_PATH,
} from "./lib/auth/public-paths";
import { apiError } from "./server/http/api-error";

/**
 * Same value as `SESSION_COOKIE` in `server/auth/cookie.ts`, which cannot be imported here:
 * it pulls in the database client, and middleware runs before the database is reachable.
 */
const SESSION_COOKIE = "sq_session";

/**
 * Response header (same name in `src/pwa/service-worker.js`) naming the session a page belongs to. The service worker keeps opened pages
 * for offline use only under this tag and drops them all when it changes (another sign-in).
 */
const OWNER_HEADER = "x-sq-owner";

/**
 * Short one-way tag of the session token (cyrb53). It only tells sessions apart on this device;
 * 53 bits of a long random token cannot be turned back into the token.
 */
function sessionTag(token: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < token.length; i++) {
    const ch = token.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Only checks that a session cookie is present; `requireUser()` in the `(app)` layout validates
 * it against the database. A visitor without one at the bare main address (`/`) goes to the
 * welcome page; other protected pages, and `/?…` deep links, go to login with `next`.
 * Protected responses are never cached, so the back button after logout does not show
 * protected content.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const nextPath = safeNextPath(`${pathname}${search}`);
  let response: NextResponse;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    const headers = new Headers(request.headers);
    headers.set(NEXT_PATH_HEADER, nextPath);
    response = NextResponse.next({ request: { headers } });
    if (!isApi) response.headers.set(OWNER_HEADER, sessionTag(session));
  } else if (isApi) {
    return apiError(401, "UNAUTHENTICATED");
  } else if (pathname === "/" && !search) {
    response = NextResponse.redirect(new URL(WELCOME_PATH, request.url));
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
