import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { enqueueIntro } from "./outbox";
import { decryptSecret, ZaloSecretError } from "./secret";

/** 200 for every verified call (also ignored ones), so Zalo does not retry. */
export type ZaloUpdateResult = { status: 200 | 401 | 404 | 503; linked: boolean };

const CHAT_ID_MAX = 128;

/** Hashing both sides gives equal-length buffers: the compare leaks neither value nor length. */
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * The group chat id of an update (`message.chat` with type `GROUP`, at the top level or under
 * `result` as Zalo wraps it), or null for private chats and anything malformed.
 */
export function groupChatId(body: unknown): string | null {
  const root = asObject(body);
  const update = asObject(root?.result) ?? root;
  const chat = asObject(asObject(update?.message)?.chat);
  if (!chat) return null;
  const type = chat.chat_type ?? chat.type;
  if (typeof type !== "string" || type.toUpperCase() !== "GROUP") return null;
  const id = typeof chat.id === "number" && Number.isFinite(chat.id) ? String(chat.id) : chat.id;
  if (typeof id !== "string") return null;
  const chatId = id.trim();
  return chatId && chatId.length <= CHAT_ID_MAX ? chatId : null;
}

/**
 * Handles one Zalo webhook call (S-85 AC 3, AC 4). Unknown `hookId` -> 404; the
 * `X-Bot-Api-Secret-Token` header is compared in constant time with the bot's stored secret
 * (wrong or unreadable -> 401). The first group the bot hears from becomes its group
 * (`chatId`, `linkedAt`; a conditional update, so concurrent mentions link one group only) and
 * every tournament of the bot without `introPostedAt` queues its introduction. A bot that is
 * already linked ignores other groups; private chats and malformed bodies are ignored. Only the
 * chat id is stored; the bot never replies.
 */
export async function handleZaloUpdate(
  hookId: string,
  secretHeader: string | null,
  body: unknown,
): Promise<ZaloUpdateResult> {
  const bot = await db.zaloBot.findUnique({
    where: { hookId },
    select: { id: true, secretEnc: true, chatId: true },
  });
  if (!bot) return { status: 404, linked: false };

  let expected: string;
  try {
    expected = decryptSecret(bot.secretEnc);
  } catch (e) {
    if (e instanceof ZaloSecretError && e.code === "ZALO_NOT_CONFIGURED") {
      return { status: 503, linked: false };
    }
    return { status: 401, linked: false };
  }
  if (!secretHeader || !sameSecret(secretHeader, expected)) return { status: 401, linked: false };

  if (bot.chatId) return { status: 200, linked: false };
  const chatId = groupChatId(body);
  if (!chatId) return { status: 200, linked: false };

  const linked = await db.$transaction(async (tx) => {
    const claimed = await tx.zaloBot.updateMany({
      where: { id: bot.id, chatId: null },
      // A call that verified with the secret proves the webhook works.
      data: { chatId, linkedAt: new Date(), webhookOk: true },
    });
    if (claimed.count === 0) return false;
    const tournaments = await tx.tournamentZalo.findMany({
      where: { zaloBotId: bot.id, introPostedAt: null },
      select: { tournamentId: true },
      orderBy: { createdAt: "asc" },
    });
    for (const { tournamentId } of tournaments) await enqueueIntro(tx, tournamentId);
    return true;
  });
  return { status: 200, linked };
}
