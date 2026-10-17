import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { sendMessage, ZaloApiError } from "./client";
import { hasRenderer, renderZalo, type ZaloStoredPayload } from "./render";
import { decryptSecret, ZaloSecretError } from "./secret";

export type ZaloRunCounts = { sent: number; retried: number; failed: number };

/** A message that failed this many times is given up. */
const MAX_ATTEMPTS = 5;
const REASON_MAX = 300;
/** How long one bot's run may hold its delivery lock (each send times out after 10 s). */
const BOT_RUN_MS = 120_000;

let warnedNotConfigured = false;

/** Plain reason for the organizer: never the key (redacted again, defensively). */
function reasonOf(error: unknown, key: string): { reason: string; final: boolean } {
  let reason: string;
  let final = false;
  if (error instanceof ZaloApiError) {
    reason = error.code === 0 ? error.message : `Zalo error ${error.code}: ${error.message}`;
    final = error.code === 403 || /not (in|a member of) (the |this )?group/i.test(error.message);
  } else if (error instanceof ZaloSecretError) {
    reason = "The bot key cannot be read; save the key again";
  } else {
    reason = "Unexpected delivery error";
  }
  if (key) reason = reason.split(key).join("***");
  return { reason: reason.slice(0, REASON_MAX), final };
}

/**
 * Sends the pending Zalo messages (#433), at most `limit` per run, oldest first per bot and
 * strictly in order: a bot whose message fails stops for this run. Each bot runs under a
 * transaction-level advisory lock, so a concurrent run (an `after()` and a tick) never sends a
 * message twice; the lock transaction touches no game rows. Text is rendered at send time.
 * On success the message is `SENT` and the bot's problem is cleared; on error `attempts` grows
 * and the plain reason is stored on the message and the bot; a 403, "bot not in group" or the
 * 5th failure marks it `FAILED`. Messages are never deleted (a `ZaloSwimPost` hangs on them).
 * Never throws and never runs inside a game transaction.
 */
export async function deliverPendingZalo(
  options: { limit?: number; now?: Date } = {},
): Promise<ZaloRunCounts> {
  const counts: ZaloRunCounts = { sent: 0, retried: 0, failed: 0 };
  try {
    // Without the secret no key can be read: leave everything pending, touch nothing.
    assertSecretConfigured();
  } catch {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn("zalo: ZALO_KEY_SECRET is not configured; Zalo delivery is off");
    }
    return counts;
  }
  let budget = options.limit ?? 100;
  try {
    const bots = await db.$queryRaw<{ zaloBotId: string }[]>`
      SELECT "zaloBotId" FROM "ZaloMessage" WHERE status = 'PENDING'
      GROUP BY "zaloBotId" ORDER BY min("createdAt")`;
    for (const { zaloBotId } of bots) {
      if (budget <= 0) break;
      try {
        budget -= await deliverForBot(zaloBotId, budget, options.now, counts);
      } catch (error) {
        console.error("zalo: bot delivery failed", error instanceof Error ? error.name : "unknown");
      }
    }
  } catch (error) {
    console.error("zalo: delivery run failed", error instanceof Error ? error.name : "unknown");
  }
  return counts;
}

function assertSecretConfigured(): void {
  try {
    decryptSecret("");
  } catch (e) {
    if (e instanceof ZaloSecretError && e.code === "ZALO_KEY_UNREADABLE") return;
    throw e;
  }
}

/** Delivers one bot's queue under its lock; returns the number of messages attempted. */
async function deliverForBot(
  zaloBotId: string,
  limit: number,
  now: Date | undefined,
  counts: ZaloRunCounts,
): Promise<number> {
  return db.$transaction(
    async (lockTx) => {
      const [lock] = await lockTx.$queryRaw<{ ok: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${`zalo:${zaloBotId}`})) AS ok`;
      if (!lock?.ok) return 0; // Another run is delivering this bot.

      const bot = await db.zaloBot.findUnique({
        where: { id: zaloBotId },
        select: { tokenEnc: true },
      });
      if (!bot) return 0;
      const messages = await db.zaloMessage.findMany({
        where: { zaloBotId, status: "PENDING" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit,
        select: { id: true, chatId: true, kind: true, payload: true, attempts: true },
      });

      let key = "";
      let attempted = 0;
      for (const msg of messages) {
        // A kind without its renderer yet waits (in order) instead of being given up.
        if (!hasRenderer(msg.kind)) break;
        attempted += 1;
        const payload = (msg.payload ?? {}) as ZaloStoredPayload;
        const partsSent = Array.isArray(payload.parts) ? payload.parts.length : null;
        try {
          const text = await renderZalo(msg.kind, payload);
          if (text === null) {
            // Nothing to say (data gone): give up without blaming the bot.
            await db.zaloMessage.update({
              where: { id: msg.id },
              data: { status: "FAILED", lastError: "Nothing to send for this message" },
            });
            counts.failed += 1;
            continue;
          }
          key ||= decryptSecret(bot.tokenEnc);
          await sendMessage(key, msg.chatId, text);
        } catch (error) {
          const { reason, final } = reasonOf(error, key);
          const failed = final || msg.attempts + 1 >= MAX_ATTEMPTS;
          const at = now ?? new Date();
          await db.zaloMessage.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: reason,
              ...(failed ? { status: "FAILED" } : {}),
            },
          });
          await db.zaloBot.update({
            where: { id: zaloBotId },
            data: { lastError: reason, lastErrorAt: at },
          });
          if (failed) {
            counts.failed += 1;
            continue; // Given up: the next message may still go out.
          }
          counts.retried += 1;
          break; // Keep the order: retry this one before anything after it.
        }
        await markSent(msg.id, partsSent, now ?? new Date());
        await db.zaloBot.updateMany({
          where: { id: zaloBotId, lastError: { not: null } },
          data: { lastError: null, lastErrorAt: null },
        });
        counts.sent += 1;
      }
      return attempted;
    },
    { timeout: BOT_RUN_MS, maxWait: 10_000 },
  );
}

/**
 * Marks a message `SENT`. Parts merged into it while it was being sent were not in the post:
 * they move to a new pending message (same group key and place in the queue).
 */
async function markSent(id: string, partsSent: number | null, sentAt: Date): Promise<void> {
  await db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ payload: Prisma.JsonValue }[]>`
      SELECT payload FROM "ZaloMessage" WHERE id = ${id} FOR UPDATE`;
    const payload = (row?.payload ?? {}) as Record<string, Prisma.InputJsonValue>;
    const parts = Array.isArray(payload.parts) ? (payload.parts as Prisma.InputJsonValue[]) : null;
    if (partsSent === null || !parts || parts.length <= partsSent) {
      await tx.zaloMessage.update({
        where: { id },
        data: { status: "SENT", sentAt, lastError: null },
      });
      return;
    }
    const msg = await tx.zaloMessage.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt,
        lastError: null,
        payload: { ...payload, parts: parts.slice(0, partsSent) },
      },
      select: { zaloBotId: true, chatId: true, kind: true, groupKey: true, createdAt: true },
    });
    await tx.zaloMessage.create({
      data: { ...msg, payload: { ...payload, parts: parts.slice(partsSent) } },
    });
  });
}
