/*
 * SwimQuest service worker: offline fallback, static asset cache (#386) and the last copy of
 * pages already opened (#818). Push handling (S-67) extends this same worker; do not register a
 * second one.
 *
 * Privacy: build output (/_next/static), cut art (/art), icons and the public /offline page are
 * cached for everyone. A page's HTML is kept only when the server tagged it with the session it
 * was rendered for (x-sq-owner, set by middleware); a different tag, a redirect to /login or a
 * logout (clearAppCaches) drops every kept page, so one user's pages are never shown to another.
 * /api responses and RSC payloads always go to the network and are never stored.
 */
const VERSION = "v1";
const STATIC_CACHE = `sq-static-${VERSION}`;
const OFFLINE_CACHE = `sq-offline-${VERSION}`;
const PAGE_CACHE = `sq-pages-${VERSION}`;
const META_CACHE = `sq-meta-${VERSION}`;
const OWNER_KEY = "/__sq/page-owner";
const OWNER_HEADER = "x-sq-owner";
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
  const keep = new Set([STATIC_CACHE, OFFLINE_CACHE, PAGE_CACHE, META_CACHE]);
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

/** Cache key of a page: same URL without the fragment. */
function pageKey(request) {
  const url = new URL(request.url);
  url.hash = "";
  return url.href;
}

async function dropPages() {
  await Promise.all([caches.delete(PAGE_CACHE), caches.delete(META_CACHE)]);
}

/** Page cache writes run one after another, so a drop never races a write for the new owner. */
let pageQueue = Promise.resolve();

/**
 * Keeps the HTML of a page the signed-in player just opened. Drops every kept page when the
 * session changed or the request ended on /login (signed out or the session expired).
 */
function rememberPage(request, res) {
  const owner = res.headers.get(OWNER_HEADER);
  const finalPath = new URL(res.url || request.url).pathname;
  const signedOut = res.redirected && finalPath === "/login";
  const type = res.headers.get("content-type") || "";
  const keep =
    owner && res.ok && res.type === "basic" && !res.redirected && type.includes("text/html");
  if (!signedOut && !keep) return pageQueue;
  const copy = keep ? res.clone() : null;
  pageQueue = pageQueue
    .then(async () => {
      if (signedOut) return dropPages();
      const meta = await caches.open(META_CACHE);
      const stored = await meta.match(OWNER_KEY);
      if (!stored || (await stored.text()) !== owner) {
        await caches.delete(PAGE_CACHE);
        await meta.put(OWNER_KEY, new Response(owner));
      }
      await (await caches.open(PAGE_CACHE)).put(pageKey(request), copy);
    })
    .catch(() => undefined);
  return pageQueue;
}

/**
 * Network first. When the network fails: the last copy of this page if the player opened it
 * before, else the cached offline page.
 */
async function navigate(event) {
  const { request } = event;
  try {
    const res = await fetch(request);
    event.waitUntil(rememberPage(request, res));
    return res;
  } catch {
    const page = await caches.match(pageKey(request), { cacheName: PAGE_CACHE });
    if (page) return page;
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
    event.respondWith(navigate(event));
  } else if (url.pathname.startsWith(IMMUTABLE_PREFIX)) {
    event.respondWith(cacheFirst(request));
  } else if (STATIC_PREFIXES.some((p) => url.pathname.startsWith(p)) && !url.search) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
