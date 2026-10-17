/** Pages and endpoints anyone may open; `/x` also covers `/x/...`. */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/welcome",
  "/offline",
  "/api/health",
  "/api/locale",
];
/** Exact paths without a session; the tick job checks its own `CRON_SECRET`. */
const PUBLIC_EXACT = new Set(["/api/jobs/tick"]);
/**
 * Folders whose contents (not the folder itself) are public: auth API, build output, `public/`,
 * and the shared team finish pages `/finish/<token>` (S-82).
 */
const PUBLIC_DIRS = ["/finish/", "/api/auth/", "/api/images/", "/_next/", "/icons/", "/art/"];
const PUBLIC_FILES = new Set([
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/robots.txt",
  "/sw.js",
]);

/** Visitors who open the main address (Home, `/` without a query) without a valid session see this page (S-70). */
export const WELCOME_PATH = "/welcome";

/** Request header in which middleware passes the original path and query to the `(app)` layout. */
export const NEXT_PATH_HEADER = "x-sq-next-path";

const MAX_NEXT_LENGTH = 2048;
const ORIGIN = "http://same.site";

/** True when `pathname` can be opened without a session. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILES.has(pathname) || PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_DIRS.some((dir) => pathname.startsWith(dir))) return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * `next` when it is a same-site relative path starting with a single `/`, else `fallback`.
 * Rejects `//host`, `/\host`, absolute URLs, control characters (browsers drop tabs and
 * newlines, turning `/\t/host` into `//host`) and anything that resolves to another origin.
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length > MAX_NEXT_LENGTH) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    return new URL(next, ORIGIN).origin === ORIGIN ? next : fallback;
  } catch {
    return fallback;
  }
}
