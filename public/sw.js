/*
 * SwimQuest service worker: offline fallback and static asset cache (#386).
 * Push handling (S-67) extends this same worker; do not register a second one.
 *
 * Privacy: only build output (/_next/static), cut art (/art) and icons are cached, plus the
 * public /offline page and its assets. Pages, RSC payloads and /api responses always go to the
 * network and are never stored, so one user's content can never be shown to another.
 */
const VERSION = "v1";
const STATIC_CACHE = `sq-static-${VERSION}`;
const OFFLINE_CACHE = `sq-offline-${VERSION}`;
const OFFLINE_URL = "/offline";
const IMMUTABLE_PREFIX = "/_next/static/";
const STATIC_PREFIXES = [IMMUTABLE_PREFIX, "/art/", "/icons/"];

/** Fetches the offline page and every same-origin static asset it references. */
async function cacheOfflinePage() {
  const res = await fetch(OFFLINE_URL, { cache: "no-store", credentials: "omit" });
  if (!res.ok) return;
  const html = await res.clone().text();
  const offline = await caches.open(OFFLINE_CACHE);
  await offline.put(OFFLINE_URL, res);
  const urls = new Set();
  for (const m of html.matchAll(/(?:href|src|srcSet|srcset)="([^"]+)"/g)) {
    for (const part of m[1].split(",")) {
      const path = part.trim().split(/\s+/)[0].replace(/&amp;/g, "&");
      if (STATIC_PREFIXES.some((p) => path.startsWith(p))) urls.add(path);
    }
  }
  const assets = await caches.open(STATIC_CACHE);
  await Promise.all([...urls].map((u) => assets.add(u).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheOfflinePage()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, OFFLINE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** The page asks for a fresh offline page (e.g. after a language change or a logout). */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "sq:refresh-offline") {
    event.waitUntil(cacheOfflinePage().catch(() => undefined));
  }
});

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
  }
  return res;
}

/** Non-hashed art and icons: answer from cache at once, refresh it in the background. */
async function staleWhileRevalidate(request) {
  const hit = await caches.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })
    .catch(() => hit || Response.error());
  return hit || network;
}

/** Network only; when the network fails, the cached offline page. Pages are never stored. */
async function navigate(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
    return offline || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  } else if (url.pathname.startsWith(IMMUTABLE_PREFIX)) {
    event.respondWith(cacheFirst(request));
  } else if (STATIC_PREFIXES.some((p) => url.pathname.startsWith(p)) && !url.search) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
