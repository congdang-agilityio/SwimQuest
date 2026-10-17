import { recordHealthSignal } from "@/server/telemetry/health";

/**
 * Counts an unhandled error in an API route (answered with 5xx) as an `API_FAILURE` health
 * signal. The route pattern (`/api/join/[token]`) is stored, never the real URL, so no ids,
 * tokens or query strings end up in the table.
 */
export async function recordRouteError(context: {
  routeType?: string;
  routePath?: string;
}): Promise<void> {
  if (context.routeType !== "route" || !context.routePath?.startsWith("/api/")) return;
  await recordHealthSignal("API_FAILURE", context.routePath, 500);
}
