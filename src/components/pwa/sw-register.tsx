"use client";

import { useEffect } from "react";

/** Registers `public/sw.js` (offline page, static asset cache) in production builds. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      // Keeps the cached offline page in the current language.
      .then((reg) => reg.active?.postMessage({ type: "sq:refresh-offline" }))
      .catch(() => undefined);
  }, []);
  return null;
}

/**
 * Deletes every SwimQuest cache (called on logout), so the next person on this device starts
 * clean. The worker re-caches the public offline page on the next visit.
 */
export async function clearAppCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("sq-")).map((k) => caches.delete(k)));
  } catch {}
}
