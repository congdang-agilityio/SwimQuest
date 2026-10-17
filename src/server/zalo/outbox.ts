import type { Prisma, ZaloMessageKind } from "@prisma/client";
import { after } from "next/server";
import { db } from "@/server/db";
import { deliverPendingZalo } from "./deliver";
import { SWITCH_FOR_KIND, ZALO_SWITCH_SELECT } from "./switch-kinds";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Ids and numbers only: the text is rendered from current data when the message is sent. */
export type ZaloPayload = Record<string, Prisma.InputJsonValue>;

export interface EnqueueZaloInput {
  tournamentId: string;
  kind: ZaloMessageKind;
  payload: ZaloPayload;
  /**
   * Messages with the same key merge into one post while it is still pending: the payload is
   * appended to `payload.parts`. Ignored when `dedupeKey` is set (a deduped message never merges).
   * A function gets the group's chat id, for keys per chat (`swim:<swimId>:<chatId>`).
   */
  groupKey?: string | ((chatId: string) => string);
  /**
   * A counted swim result (#460): queued at most once ever. Skipped when a `ZaloSwimPost`
   * already exists for it; otherwise one is inserted (insert-or-ignore) with the message id.
   */
  swimResultId?: string;
  /** Queues the message at most once ever (insert-or-ignore). */
  dedupeKey?: string;
}

/**
 * Queues a Zalo message inside the caller's (game) transaction, so it exists only if the game
 * change commits. Does nothing when the tournament has no bot, its bot has no linked group, or
 * the organizer switched this kind off for the tournament (S-89 AC 2). The switch is per
 * tournament, so a counted swim of a tournament with counted swims off is left out of a group
 * post while another tournament on the same bot still adds its part. The introduction has no
 * switch.
 * Delivery runs after the response (`after()`), or on the next tick outside a request; it never
 * runs in the caller's transaction, so a Zalo problem can never undo or delay game data.
 * Returns whether a message was queued or merged.
 */
export async function enqueueZalo(tx: Tx, input: EnqueueZaloInput): Promise<boolean> {
  const { tournamentId, kind, payload, dedupeKey, swimResultId } = input;
  const settings = await tx.tournamentZalo.findUnique({
    where: { tournamentId },
    select: { ...ZALO_SWITCH_SELECT, zaloBot: { select: { id: true, chatId: true } } },
  });
  const bot = settings?.zaloBot;
  if (!bot?.chatId) return false;
  const column = SWITCH_FOR_KIND[kind];
  if (column && !settings?.[column]) return false;
  const groupKey =
    typeof input.groupKey === "function" ? input.groupKey(bot.chatId) : input.groupKey;
  if (swimResultId) {
    const posted = await tx.zaloSwimPost.findUnique({
      where: { swimResultId },
      select: { swimResultId: true },
    });
    if (posted) return false;
  }

  let queued: boolean;
  let messageId: string | null = null;
  if (dedupeKey) {
    const res = await tx.zaloMessage.createMany({
      data: [
        {
          zaloBotId: bot.id,
          chatId: bot.chatId,
          kind,
          payload: { ...payload, tournamentId },
          dedupeKey,
        },
      ],
      skipDuplicates: true,
    });
    queued = res.count > 0;
  } else if (groupKey) {
    messageId = await appendPart(
      tx,
      { zaloBotId: bot.id, chatId: bot.chatId, kind, groupKey, tournamentId },
      payload,
    );
    queued = true;
  } else {
    const created = await tx.zaloMessage.create({
      data: { zaloBotId: bot.id, chatId: bot.chatId, kind, payload: { ...payload, tournamentId } },
      select: { id: true },
    });
    messageId = created.id;
    queued = true;
  }
  if (swimResultId && messageId) {
    await tx.zaloSwimPost.createMany({
      data: [{ swimResultId, zaloMessageId: messageId }],
      skipDuplicates: true,
    });
  }
  if (queued) scheduleDelivery();
  return queued;
}

/**
 * Queues the tournament introduction (S-85 AC 4) for its bot's linked group, once per
 * tournament and group (`dedupeKey intro:<tournamentId>:<chatId>`, so a tournament moved to a
 * bot with another group introduces itself there too), and sets `introPostedAt`. Does nothing
 * while the bot has no group. The introduction always goes out (no switch).
 */
export async function enqueueIntro(tx: Tx, tournamentId: string): Promise<boolean> {
  const settings = await tx.tournamentZalo.findUnique({
    where: { tournamentId },
    select: { zaloBot: { select: { chatId: true } } },
  });
  const chatId = settings?.zaloBot.chatId;
  if (!chatId) return false;
  const queued = await enqueueZalo(tx, {
    tournamentId,
    kind: "INTRO",
    payload: {},
    dedupeKey: `intro:${tournamentId}:${chatId}`,
  });
  await tx.tournamentZalo.updateMany({
    where: { tournamentId, introPostedAt: null },
    data: { introPostedAt: new Date() },
  });
  return queued;
}

interface GroupTarget {
  zaloBotId: string;
  chatId: string;
  kind: ZaloMessageKind;
  groupKey: string;
  tournamentId: string;
}

/**
 * Appends to the pending post with this group key (row locked), or starts a new one. Returns
 * the message id.
 */
async function appendPart(tx: Tx, target: GroupTarget, part: ZaloPayload): Promise<string> {
  const [open] = await tx.$queryRaw<{ id: string; payload: Prisma.JsonValue }[]>`
    SELECT id, payload FROM "ZaloMessage"
    WHERE "groupKey" = ${target.groupKey} AND "zaloBotId" = ${target.zaloBotId}
      AND "chatId" = ${target.chatId} AND status = 'PENDING'
    ORDER BY "createdAt" DESC
    LIMIT 1
    FOR UPDATE`;
  if (open) {
    const current = (open.payload ?? {}) as { parts?: Prisma.InputJsonValue[] };
    const parts = Array.isArray(current.parts) ? current.parts : [];
    await tx.zaloMessage.update({
      where: { id: open.id },
      data: { payload: { ...(current as object), parts: [...parts, part] } },
    });
    return open.id;
  }
  const created = await tx.zaloMessage.create({
    data: {
      zaloBotId: target.zaloBotId,
      chatId: target.chatId,
      kind: target.kind,
      groupKey: target.groupKey,
      payload: { tournamentId: target.tournamentId, parts: [part] },
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Delivers once the response is sent (after the transaction committed). Outside a request
 * (scripts, tests, the tick itself) there is nothing to schedule: the next tick delivers.
 */
function scheduleDelivery(): void {
  try {
    after(() => deliverPendingZalo().then(() => undefined));
  } catch {
    // Not in a request scope.
  }
}
