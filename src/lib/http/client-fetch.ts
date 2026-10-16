/** Browser access kept behind one object so tests can stub navigation. */
export const browser = {
  currentPath: () => window.location.pathname + window.location.search,
  go: (url: string) => window.location.assign(url),
};

/**
 * `fetch` for client components calling protected APIs. A 401 means the session has ended:
 * send the player to log in again (coming back to this page afterwards) and never settle, so
 * the caller shows no generic error while the page navigates. Anything else behaves like `fetch`.
 */
export async function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;
  browser.go(`/login?next=${encodeURIComponent(browser.currentPath())}`);
  return new Promise<Response>(() => {});
}
