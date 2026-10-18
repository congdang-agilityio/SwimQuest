"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./notification-settings.module.css";

const API = "/api/me/push-subscriptions";

type Unsupported = "ios" | "zalo" | "browser";
type Status =
  | { kind: "checking" }
  | { kind: "unsupported"; reason: Unsupported }
  | { kind: "unavailable" }
  | { kind: "loadFailed" }
  | { kind: "blocked" }
  | { kind: "ready"; on: boolean; key: string };

/** Why this browser cannot get push, or null when it can. */
function unsupportedReason(): Unsupported | null {
  const ua = navigator.userAgent;
  if (/Zalo/i.test(ua)) return "zalo";
  const ios =
    /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // iPhone gets push only from the Home Screen app on iOS 16.4 or later.
  if (ios && (!standalone || !supported)) return "ios";
  return supported ? null : "browser";
}

/** The worker registration that receives pushes (`src/pwa/service-worker.js`), registering it if needed. */
async function workerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** The VAPID public key (base64url) as the bytes `pushManager.subscribe` expects. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * "Push on this device": subscribes or unsubscribes only this browser. Explains when the browser
 * cannot get push (iPhone without Add to Home Screen, Zalo's in-app browser, old browsers), when
 * the permission is blocked, and when the server has no push key yet (503).
 */
export function PushToggle() {
  const t = useTranslations("notifications.settings.push");
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"failed" | "dismissed" | null>(null);

  useEffect(() => {
    let live = true;
    async function check(): Promise<Status> {
      const reason = unsupportedReason();
      if (reason) return { kind: "unsupported", reason };
      const res = await clientFetch(API, { cache: "no-store" });
      if (res.status === 503) return { kind: "unavailable" };
      if (!res.ok) return { kind: "loadFailed" };
      const { publicKey } = (await res.json()) as { publicKey: string };
      if (Notification.permission === "denied") return { kind: "blocked" };
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      return {
        kind: "ready",
        on: Boolean(sub) && Notification.permission === "granted",
        key: publicKey,
      };
    }
    check()
      .catch((): Status => ({ kind: "loadFailed" }))
      .then((next) => {
        if (live) setStatus(next);
      });
    return () => {
      live = false;
    };
  }, []);

  async function turnOn(key: string) {
    const permission = await Notification.requestPermission();
    if (permission === "denied") {
      setStatus({ kind: "blocked" });
      return;
    }
    if (permission !== "granted") {
      setProblem("dismissed");
      return;
    }
    const reg = await workerRegistration();
    // A subscription made with another key cannot be reused: start a fresh one.
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    });
    const res = await clientFetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) {
      await sub.unsubscribe().catch(() => undefined);
      throw new Error("save failed");
    }
    setStatus({ kind: "ready", on: true, key });
  }

  async function turnOff(key: string) {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      // Only this device's endpoint is removed; the player's other devices keep pushing.
      const res = await clientFetch(API, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      if (!res.ok) throw new Error("remove failed");
      await sub.unsubscribe().catch(() => undefined);
    }
    setStatus({ kind: "ready", on: false, key });
  }

  async function onChange(next: boolean) {
    if (status.kind !== "ready") return;
    setBusy(true);
    setProblem(null);
    try {
      await (next ? turnOn(status.key) : turnOff(status.key));
    } catch {
      setProblem("failed");
    } finally {
      setBusy(false);
    }
  }

  const on = status.kind === "ready" && status.on;
  let hint: string;
  if (status.kind === "checking") hint = t("checking");
  else if (status.kind === "ready") hint = on ? t("on") : t("off");
  else hint = t("offHere");

  return (
    <div className={styles.push}>
      <Switch
        id="push-device"
        label={t("label")}
        hint={hint}
        checked={on}
        disabled={status.kind !== "ready" || busy}
        onChange={onChange}
      />
      {status.kind === "ready" && <p className={styles.note}>{t("otherDevices")}</p>}
      {status.kind === "unsupported" && (
        <div className={styles.callout} data-testid="push-unsupported">
          <p className={styles.calloutTitle}>{t("unsupportedTitle")}</p>
          <p className={styles.calloutText}>{t(`unsupported.${status.reason}`)}</p>
        </div>
      )}
      {status.kind === "unavailable" && (
        <div className={styles.callout} data-testid="push-unavailable">
          <p className={styles.calloutTitle}>{t("unavailableTitle")}</p>
          <p className={styles.calloutText}>{t("unavailable")}</p>
        </div>
      )}
      {status.kind === "blocked" && (
        <div className={styles.callout} data-testid="push-blocked">
          <p className={styles.calloutTitle}>{t("blockedTitle")}</p>
          <p className={styles.calloutText}>{t("blocked")}</p>
        </div>
      )}
      <div aria-live="polite">
        {status.kind === "loadFailed" && (
          <p className={styles.problem} role="alert">
            {t("loadFailed")}
          </p>
        )}
        {problem && (
          <p className={styles.problem} role="alert">
            {t(problem)}
          </p>
        )}
      </div>
    </div>
  );
}
