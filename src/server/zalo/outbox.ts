import type { Prisma, ZaloMessageKind } from "@prisma/client";
import { after } from "next/server";
import { db } from "@/server/db";
import { deliverPendingZalo } from "./deliver";

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
   */
  groupKey?: string;
  /** Queues the message at most once ever (insert-or-ignore). */
  dedupeKey?: string;
}

/**
 * Queues a Zalo message inside the caller's (game) transaction, so it exists only if the game
 * change commits. Does nothing when the tournament has no bot or its bot has no linked group.
 * Delivery runs after the response (`after()`), or on the next tick outside a request; it never
 * runs in the caller's transaction, so a Zalo problem can never undo or delay game data.
 * Returns whether a message was queued or merged.
 */
export async function enqueueZalo(tx: Tx, input: EnqueueZaloInput): Promise<boolean> {
  const { tournamentId, kind, payload, groupKey, dedupeKey } = input;
  const settings = await tx.tournamentZalo.findUnique({
    where: { tournamentId },
    select: { zaloBot: { select: { id: true, chatId: true } } },
  });
  const bot = settings?.zaloBot;
  if (!bot?.chatId) return false;

  let queued: boolean;
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
    await appendPart(
      tx,
      { zaloBotId: bot.id, chatId: bot.chatId, kind, groupKey, tournamentId },
      payload,
    );
    queued = true;
  } else {
    await tx.zaloMessage.create({
      data: { zaloBotId: bot.id, chatId: bot.chatId, kind, payload: { ...payload, tournamentId } },
    });
    queued = true;
  }
  if (queued) scheduleDelivery();
  return queued;
}

interface GroupTarget {
  zaloBotId: string;
  chatId: string;
  kind: ZaloMessageKind;
  groupKey: string;
  tournamentId: string;
}

/** Appends to the pending post with this group key (row locked), or starts a new one. */
async function appendPart(tx: Tx, target: GroupTarget, part: ZaloPayload): Promise<void> {
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
    return;
  }
  await tx.zaloMessage.create({
    data: {
      zaloBotId: target.zaloBotId,
      chatId: target.chatId,
      kind: target.kind,
      groupKey: target.groupKey,
      payload: { tournamentId: target.tournamentId, parts: [part] },
    },
  });
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
