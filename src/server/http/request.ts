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
