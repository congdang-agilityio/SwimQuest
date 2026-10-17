/** Next.js hook for errors thrown while handling a request; only the Node runtime reports. */
export async function onRequestError(
  _error: unknown,
  _request: unknown,
  context: { routeType?: string; routePath?: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recordRouteError } = await import("./instrumentation-node");
    await recordRouteError(context);
  }
}
