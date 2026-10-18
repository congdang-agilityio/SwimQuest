/**
 * Offers a new deploy to open pages (#922), after RunnerWars' app-update. A check runs 5 s after
 * start, whenever the app comes back on screen and every 30 min (at most once a minute): it asks
 * the browser to look for a new service worker and compares this page's build with the one the
 * server serves (`/api/version`), because iOS can keep an old app without ever seeing the new
 * worker. A new version is never applied by itself: the "Update" card (components/pwa/
 * update-card) calls applyUpdate().
 */
import { isBusy } from "./busy";

/** The build this page was loaded from (inlined by next.config.ts). */
export const PAGE_BUILD = process.env.SQ_BUILD_ID ?? "dev";

type State = { available: boolean; dismissed: boolean };
let state: State = { available: false, dismissed: false };
const listeners = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export const getUpdateState = () => state;
export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** "Later": hides the card until the app comes back on screen. */
export const dismissUpdate = () => setState({ dismissed: true });

const CHECK_EVERY_MS = 30 * 60_000;
const MIN_GAP_MS = 60_000;
const STARTUP_CHECK_MS = 5_000;
const TAKEOVER_TIMEOUT_MS = 4_000;
let lastCheck = 0;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration().catch(() => undefined)) ?? null;
}

/** The build the server serves now, or null when it can't be reached. */
async function serverBuild(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    const body = res.ok ? await res.json() : null;
    return typeof body?.build === "string" ? body.build : null;
  } catch {
    return null;
  }
}

/**
 * A new worker finished installing and waits. If this page already runs the server's build (it
 * was reloaded after the deploy, under the old worker), the visible app is already new: let the
 * worker take over quietly. Otherwise offer the update.
 */
async function onWaitingWorker(reg: ServiceWorkerRegistration) {
  const latest = await serverBuild();
  if (latest && latest === PAGE_BUILD) reg.waiting?.postMessage({ type: "SKIP_WAITING" });
  else setState({ available: true });
}

/** Watches the registration for a new worker that has installed and now waits. */
export function watchRegistration(reg: ServiceWorkerRegistration) {
  // Without a controller this is the first install: it activates by itself, nothing to offer.
  if (reg.waiting && navigator.serviceWorker.controller) void onWaitingWorker(reg);
  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        void onWaitingWorker(reg);
      }
    });
  });
}

/** Looks for a newer app version; when there is one, the card offers it. */
export async function checkForUpdate() {
  lastCheck = Date.now();
  const reg = await registration();
  await reg?.update().catch(() => undefined);
  const latest = await serverBuild();
  if (latest && latest !== PAGE_BUILD) setState({ available: true });
}

let reloading = false;
function reloadOnce() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

/** "Update" on the card: switch to the waiting version and reload, or reload from the network. */
export async function applyUpdate() {
  if (isBusy()) return;
  const reg = await registration();
  if (reg) {
    if (!reg.waiting) {
      await Promise.race([
        reg.update().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      await installed(reg, 8_000);
    }
    if (reg.waiting) {
      // Reload once the new worker has taken over this page, or after a few seconds anyway.
      navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      setTimeout(reloadOnce, TAKEOVER_TIMEOUT_MS);
      return;
    }
  }
  // No new worker (service workers blocked or unsupported, or iOS keeping the old one): pages are
  // network first, so a reload loads the new build. The worker is never unregistered here,
  // because that would drop the player's push subscription.
  reloadOnce();
}

/** Resolves once a just-found worker has installed (waiting) or failed, or after `ms`. */
function installed(reg: ServiceWorkerRegistration, ms: number): Promise<void> {
  const worker = reg.installing;
  if (!worker) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    worker.addEventListener("statechange", () => {
      if (worker.state !== "installing") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

let watching = false;

/**
 * An installed app (iOS especially) resumes without navigating, so the browser never looks for
 * a new version by itself. Check shortly after start, when it comes back on screen and every
 * 30 min, never during an upload.
 */
export function watchForUpdates() {
  if (watching) return;
  watching = true;
  const maybeCheck = () => {
    if (document.visibilityState !== "visible" || isBusy()) return;
    if (Date.now() - lastCheck < MIN_GAP_MS) return;
    void checkForUpdate();
  };
  document.addEventListener("visibilitychange", () => {
    // "Later" lasts until the app comes back on screen.
    if (document.visibilityState === "visible") setState({ dismissed: false });
    maybeCheck();
  });
  setInterval(maybeCheck, CHECK_EVERY_MS);
  setTimeout(maybeCheck, STARTUP_CHECK_MS);
}
