"use client";

import { useEffect } from "react";
import { watchForUpdates, watchRegistration } from "@/lib/pwa/app-update";

/**
 * Registers the service worker `/sw.js` (offline page, static assets, opened pages; source in
 * `src/pwa/service-worker.js`) in production builds, and starts the checks for a new deploy
 * (#922), which also run when service workers are blocked or unsupported.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    watchForUpdates();
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        watchRegistration(reg);
        return navigator.serviceWorker.ready;
      })
      // Keeps the cached offline page in the current language.
      .then((reg) => reg.active?.postMessage({ type: "sq:refresh-offline" }))
      .catch(() => undefined);
  }, []);
  return null;
}

/**
 * Deletes every SwimQuest cache (called on logout), including the pages kept for offline use, so
 * the next person on this device starts clean. The worker re-caches the public offline page on
 * the next visit. A sign-in with another session also drops the kept pages (see `src/pwa/service-worker.js`).
 */
export async function clearAppCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("sq-")).map((k) => caches.delete(k)));
  } catch {}
}
