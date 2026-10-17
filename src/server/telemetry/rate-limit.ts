const WINDOW_MS = 60_000;
const LIMIT = 20;
const MAX_KEYS = 5_000;
const windows = new Map<string, { start: number; count: number }>();

/**
 * At most 20 telemetry reports per signed-in user (one session each) per minute. In memory per
 * server instance, which is enough to bound abuse; the map is pruned so it cannot grow forever.
 */
export function allowTelemetry(key: string, now: number = Date.now()): boolean {
  if (windows.size >= MAX_KEYS) {
    for (const [k, w] of windows) if (now - w.start >= WINDOW_MS) windows.delete(k);
    if (windows.size >= MAX_KEYS) windows.clear();
  }
  const w = windows.get(key);
  if (!w || now - w.start >= WINDOW_MS) {
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  w.count += 1;
  return w.count <= LIMIT;
}
