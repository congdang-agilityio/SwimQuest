/**
 * Counts an unhandled error in an API route (answered with 5xx) as an `API_FAILURE` health
 * signal. The route pattern (`/api/join/[token]`) is stored, never the real URL, so no ids,
 * tokens or query strings end up in the table.
 */
export async function onRequestError(
  _error: unknown,
  _request: unknown,
  context: { routeType?: string; routePath?: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (context.routeType !== "route" || !context.routePath?.startsWith("/api/")) return;
  const { recordHealthSignal } = await import("@/server/telemetry/health");
  await recordHealthSignal("API_FAILURE", context.routePath, 500);
}
