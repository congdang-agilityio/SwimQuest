import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serves the service worker at `/sw.js` with this build's id written into it (#922), so each
 * deploy ships a byte-different worker and browsers install the new version (see
 * `src/pwa/service-worker.js`). Read from the repo at runtime, like `messages/`.
 */
export const dynamic = "force-dynamic";

const SOURCE = path.join(process.cwd(), "src", "pwa", "service-worker.js");
let cached: string | null = null;

export async function GET(): Promise<Response> {
  if (!cached || process.env.NODE_ENV !== "production") {
    const source = await readFile(SOURCE, "utf8");
    cached = source.replace('"__SQ_BUILD__"', JSON.stringify(process.env.SQ_BUILD_ID ?? "dev"));
  }
  return new Response(cached, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      // Always revalidated, never an HTTP-cached copy.
      "cache-control": "no-cache",
    },
  });
}
