const MAX_PER_PAGE = 10;
let sent = 0;
const reported = new Set<string>();

/**
 * Fire-and-forget report to /api/telemetry. Bounded (once per distinct key, at most 10 per page
 * view), uses `sendBeacon`, and never throws, so reporting can not break a page.
 */
export function reportTelemetry(key: string, payload: Record<string, string>): void {
  try {
    if (reported.has(key) || sent >= MAX_PER_PAGE) return;
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    reported.add(key);
    sent += 1;
    navigator.sendBeacon(
      "/api/telemetry",
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
  } catch {
    // reporting is best effort
  }
}
