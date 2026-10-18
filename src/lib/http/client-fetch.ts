import { trackBusy } from "@/lib/pwa/busy";

/** Browser access kept behind one object so tests can stub navigation. */
export const browser = {
  currentPath: () => window.location.pathname + window.location.search,
  go: (url: string) => window.location.assign(url),
};

/**
 * `fetch` for client components calling protected APIs. A 401 means the session has ended:
 * send the player to log in again (coming back to this page afterwards) and never settle, so
 * the caller shows no generic error while the page navigates. Anything else behaves like `fetch`.
 * A request that changes something (not GET/HEAD) marks the app busy, so the update card waits.
 */
export async function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const request = fetch(input, init);
  const res = await (method === "GET" || method === "HEAD" ? request : trackBusy(request));
  if (res.status !== 401) return res;
  browser.go(`/login?next=${encodeURIComponent(browser.currentPath())}`);
  return new Promise<Response>(() => {});
}
