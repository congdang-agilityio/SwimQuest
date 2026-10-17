import { createTranslator } from "next-intl";
import webpush, { WebPushError } from "web-push";
import { loadMessages, resolveLocale, type Locale } from "@/i18n/load-messages";
import { db } from "@/server/db";
import { skipSwitchedOffPushes } from "@/server/notifications/preferences";

/** Notifications older than this are never pushed (e.g. created while push was not configured). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** How long the push service keeps a message for an offline device. */
const TTL_SECONDS = 24 * 60 * 60;

export type PushRunCounts = { sent: number; removed: number; failed: number };
const NONE: PushRunCounts = { sent: 0, removed: 0, failed: 0 };

let warnedMissingKeys = false;

/** Sets up web-push from the VAPID variables; false (warned once, no values logged) when missing. */
function configured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    if (!warnedMissingKeys) {
      warnedMissingKeys = true;
      console.warn("push: VAPID keys are not configured; push delivery is off");
    }
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch {
    if (!warnedMissingKeys) {
      warnedMissingKeys = true;
      console.warn("push: VAPID keys are invalid; push delivery is off");
    }
    return false;
  }
}

/** Title and body of a notification in the reader's language, as the in-app list renders it. */
async function render(
  locale: Locale,
  type: string,
  params: Record<string, unknown>,
): Promise<{ title: string; body: string }> {
  const messages = await loadMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "notifications" });
  const routes = createTranslator({ locale, messages, namespace: "routes.route01" });
  const slug = typeof params.destination === "string" ? params.destination : "";
  const key = `types.${type}`;
  const body = t.has(key as never)
    ? t(
        key as never,
        {
          destination: slug && routes.has(slug as never) ? routes(slug as never) : "",
          level: Number(params.level ?? 0),
        } as never,
      )
    : t("unknown" as never);
  return { title: t("push.title" as never), body };
}

/**
 * Pushes new notifications to every device of their recipient (S-67, #385), at most `limit` per
 * run. Without VAPID variables it does nothing and touches no data. Otherwise it first marks the
 * notifications of categories the recipient switched off as handled (S-68,
 * `skipSwitchedOffPushes`) and the ones too old to push, then claims a batch (sets `pushedAt`,
 * so a concurrent run or a later tick never sends it again) and delivers it. Push services
 * answering 404/410 drop that subscription. Never throws.
 */
export async function sendPendingPushes(limit = 100): Promise<PushRunCounts> {
  if (!configured()) return NONE;
  const counts = { ...NONE };
  try {
    await skipSwitchedOffPushes();
    const cutoff = new Date(Date.now() - MAX_AGE_MS);
    await db.notification.updateMany({
      where: { pushedAt: null, createdAt: { lt: cutoff } },
      data: { pushedAt: new Date() },
    });
    const claimed = await db.$queryRaw<{ id: string }[]>`
      UPDATE "Notification" SET "pushedAt" = now()
      WHERE id IN (
        SELECT id FROM "Notification"
        WHERE "pushedAt" IS NULL AND "createdAt" >= ${cutoff}
        ORDER BY "createdAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    if (claimed.length === 0) return counts;
    const rows = await db.notification.findMany({
      where: { id: { in: claimed.map((c) => c.id) } },
      select: {
        type: true,
        params: true,
        link: true,
        user: {
          select: {
            locale: true,
            pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
          },
        },
      },
    });
    for (const row of rows) {
      if (row.user.pushSubscriptions.length === 0) continue;
      const params = (row.params ?? {}) as Record<string, unknown>;
      const text = await render(resolveLocale(row.user.locale), row.type, params);
      // Title, body and the internal link only: no ids beyond the link, no email.
      const payload = JSON.stringify({ ...text, url: row.link });
      for (const sub of row.user.pushSubscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: TTL_SECONDS },
          );
          counts.sent += 1;
        } catch (error) {
          const status = error instanceof WebPushError ? error.statusCode : 0;
          if (status === 404 || status === 410) {
            await db.pushSubscription.deleteMany({ where: { id: sub.id } });
            counts.removed += 1;
          } else {
            counts.failed += 1;
            // Status only: the endpoint is a device secret and is not logged.
            console.error(`push: delivery failed (status ${status || "network"})`);
          }
        }
      }
    }
  } catch (error) {
    console.error("push: run failed", error instanceof Error ? error.message : "unknown error");
  }
  return counts;
}
