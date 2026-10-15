/**
 * The public origin for URLs that are stored, emailed or shown (for example invite links).
 * It comes from the trusted `APP_URL` setting, never from request headers such as
 * `x-forwarded-host`. Without `APP_URL`, development and test fall back to the request URL's
 * own origin; anywhere else this throws, as it does for an `APP_URL` that is not http(s).
 */
export function publicOrigin(request: Request): string {
  return publicOriginFrom(new URL(request.url).origin);
}

/** `publicOrigin` with an explicit fallback, used only in development and test. */
export function publicOriginFrom(fallback: string): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    let url: URL | undefined;
    try {
      url = new URL(configured);
    } catch {}
    if (url?.protocol !== "http:" && url?.protocol !== "https:") {
      throw new Error("APP_URL must be an absolute http(s) URL.");
    }
    return url.origin;
  }
  const env = process.env.NODE_ENV;
  if (env === "development" || env === "test") return fallback;
  throw new Error("APP_URL is not set: the public origin is unknown.");
}

/** False for cross-site browser requests: a foreign or opaque Origin, or Sec-Fetch-Site. */
export function isSameOrigin(request: Request): boolean {
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

/** The parsed body of an `application/json` request, or `{ ok: false }` for anything else. */
export async function readJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.split(";")[0].trim().toLowerCase() !== "application/json") return { ok: false };
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}
