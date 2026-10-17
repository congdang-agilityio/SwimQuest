import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { requireOrganizer } from "@/server/auth/roles";
import { getMe, setWebhook, ZaloApiError } from "./client";
import { enqueueIntro } from "./outbox";
import { decryptSecret, encryptSecret, keyHint, ZaloSecretError } from "./secret";

export type ZaloSettingsErrorCode =
  | "INVALID_KEY"
  | "INVALID_ORIGIN"
  | "NO_BOT"
  | "TOURNAMENT_CLOSED"
  | "ZALO_KEY_REJECTED"
  | "ZALO_UNREACHABLE";

const MESSAGES: Record<ZaloSettingsErrorCode, string> = {
  INVALID_KEY: "This is not a Zalo bot key",
  INVALID_ORIGIN: "The app origin for the webhook is not a valid http(s) origin",
  NO_BOT: "This tournament has no Zalo bot",
  TOURNAMENT_CLOSED: "Zalo settings cannot change on a completed tournament",
  ZALO_KEY_REJECTED: "Zalo did not accept this key",
  ZALO_UNREACHABLE: "Zalo could not be reached, try again later",
};

/** A refused Zalo settings change. Messages never carry the key. */
export class ZaloSettingsError extends Error {
  readonly status: 400 | 404 | 409 | 503;
  constructor(readonly code: ZaloSettingsErrorCode) {
    super(MESSAGES[code]);
    this.name = "ZaloSettingsError";
    this.status =
      code === "TOURNAMENT_CLOSED"
        ? 409
        : code === "ZALO_UNREACHABLE"
          ? 503
          : code === "NO_BOT"
            ? 404
            : 400;
  }
}

/** What the organizer sees: never the key, the webhook secret or `tokenEnc`. */
export interface ZaloSettings {
  botName: string;
  keyHint: string;
  connected: boolean;
  linkedAt: Date | null;
  webhookOk: boolean;
}

const KEY_MAX = 256;
/** Keys go into the URL path (`/bot<key>/…`), so no whitespace, slashes or URL syntax. */
const KEY_SHAPE = /^[A-Za-z0-9:_\-.]+$/;
const SETTINGS_SELECT = {
  botName: true,
  tokenHint: true,
  chatId: true,
  linkedAt: true,
  webhookOk: true,
} satisfies Prisma.ZaloBotSelect;

/** Organizer only; refused (ARCHIVED by the role guard, COMPLETED here) once the tournament ended. */
export async function requireOpenTournament(userId: string, tournamentId: string) {
  const t = await requireOrganizer(userId, tournamentId, { write: true });
  if (t.status === "COMPLETED") throw new ZaloSettingsError("TOURNAMENT_CLOSED");
  return t;
}

function normalizeOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.origin;
  } catch {
    throw new ZaloSettingsError("INVALID_ORIGIN");
  }
}

/** The tournament's Zalo settings, or null when no bot is set. */
export async function getZaloSettings(
  userId: string,
  tournamentId: string,
): Promise<ZaloSettings | null> {
  await requireOrganizer(userId, tournamentId);
  const row = await db.tournamentZalo.findUnique({
    where: { tournamentId },
    select: { zaloBot: { select: SETTINGS_SELECT } },
  });
  if (!row) return null;
  const bot = row.zaloBot;
  return {
    botName: bot.botName,
    keyHint: bot.tokenHint,
    connected: bot.chatId !== null,
    linkedAt: bot.linkedAt,
    webhookOk: bot.webhookOk,
  };
}

/**
 * Saves a bot key on a tournament (S-85 AC 2, AC 5). The key is checked with Zalo `getMe`
 * first; nothing is stored when Zalo rejects it or cannot be reached. The organizer's bot with
 * the same Zalo id is reused (its group link and webhook id stay, the key is re-encrypted), or
 * a new one is created with a random webhook id and secret. The webhook is (re)registered at
 * `<origin>/api/zalo/webhook/<hookId>`; a failure there is stored as `webhookOk: false` and the
 * save still succeeds. When the bot already posts to a group, this tournament's introduction is
 * queued. Audited as `ZALO_BOT_SET` with the bot name and key hint only.
 */
export async function saveZaloBotKey(
  userId: string,
  tournamentId: string,
  key: string,
  origin: string,
): Promise<ZaloSettings> {
  await requireOpenTournament(userId, tournamentId);
  const token = typeof key === "string" ? key.trim() : "";
  if (!token || token.length > KEY_MAX || !KEY_SHAPE.test(token)) {
    throw new ZaloSettingsError("INVALID_KEY");
  }
  const appOrigin = normalizeOrigin(origin);
  // Fails closed (ZALO_NOT_CONFIGURED) before Zalo is contacted when the secret is not set.
  const tokenEnc = encryptSecret(token);
  const tokenHint = keyHint(token);

  let botId: string;
  let botName: string;
  try {
    const me = await getMe(token);
    botId = typeof me?.id === "string" || typeof me?.id === "number" ? String(me.id) : "";
    botName = (me?.display_name || me?.account_name || "").trim();
  } catch (e) {
    if (e instanceof ZaloApiError) {
      throw new ZaloSettingsError(e.code === 0 ? "ZALO_UNREACHABLE" : "ZALO_KEY_REJECTED");
    }
    throw e;
  }
  if (!botId) throw new ZaloSettingsError("ZALO_KEY_REJECTED");
  if (!botName) botName = "Zalo bot";

  const existing = await db.zaloBot.findUnique({
    where: { ownerUserId_botId: { ownerUserId: userId, botId } },
    select: { id: true, hookId: true, secretEnc: true },
  });
  const hookId = existing?.hookId ?? randomBytes(16).toString("base64url");
  let webhookSecret = existing ? readSecret(existing.secretEnc) : null;
  const secretChanged = webhookSecret === null;
  webhookSecret ??= randomBytes(32).toString("base64url");
  const secretEnc = encryptSecret(webhookSecret);

  let webhookOk = true;
  let lastError: string | null = null;
  try {
    await setWebhook(token, `${appOrigin}/api/zalo/webhook/${hookId}`, webhookSecret);
  } catch (e) {
    if (!(e instanceof ZaloApiError)) throw e;
    webhookOk = false;
    lastError =
      e.code === 0
        ? "Webhook not registered: Zalo unreachable"
        : `Webhook not registered (Zalo error ${e.code})`;
  }
  const now = new Date();
  const problem = { lastError, lastErrorAt: lastError ? now : null };

  return db.$transaction(async (tx) => {
    const bot = await tx.zaloBot.upsert({
      where: { ownerUserId_botId: { ownerUserId: userId, botId } },
      // A concurrent save may have created the bot meanwhile: keep its hook id and secret.
      update: {
        botName,
        tokenEnc,
        tokenHint,
        origin: appOrigin,
        ...(existing && secretChanged ? { secretEnc } : {}),
        ...(existing ? { webhookOk, ...problem } : {}),
      },
      create: {
        ownerUserId: userId,
        botId,
        botName,
        tokenEnc,
        tokenHint,
        hookId,
        secretEnc,
        origin: appOrigin,
        webhookOk,
        ...problem,
      },
      select: { id: true, ...SETTINGS_SELECT },
    });

    const before = await tx.tournamentZalo.findUnique({
      where: { tournamentId },
      select: { zaloBotId: true, zaloBot: { select: { botName: true, tokenHint: true } } },
    });
    const sameBot = before?.zaloBotId === bot.id;
    // Update in place so the message switches survive a bot change (#411 review note).
    await tx.tournamentZalo.upsert({
      where: { tournamentId },
      update: sameBot ? {} : { zaloBotId: bot.id, introPostedAt: null },
      create: { tournamentId, zaloBotId: bot.id },
    });
    if (bot.chatId) await enqueueIntro(tx, tournamentId);

    await recordAudit(tx, {
      actor: { type: "USER", userId },
      action: AUDIT_ACTIONS.ZALO_BOT_SET,
      entityType: "TOURNAMENT",
      entityId: tournamentId,
      tournamentId,
      ...(before
        ? { before: { botName: before.zaloBot.botName, keyHint: before.zaloBot.tokenHint } }
        : {}),
      after: { botName: bot.botName, keyHint: bot.tokenHint },
    });

    return {
      botName: bot.botName,
      keyHint: bot.tokenHint,
      connected: bot.chatId !== null,
      linkedAt: bot.linkedAt,
      webhookOk: bot.webhookOk,
    };
  });
}

/**
 * Removes the bot from this tournament only (S-85 AC 5): the bot, its group link and its other
 * tournaments keep working. Audited as `ZALO_BOT_REMOVED`; nothing happens when no bot is set.
 */
export async function removeZaloBot(userId: string, tournamentId: string): Promise<void> {
  await requireOpenTournament(userId, tournamentId);
  await db.$transaction(async (tx) => {
    const row = await tx.tournamentZalo.findUnique({
      where: { tournamentId },
      select: { zaloBot: { select: { botName: true, tokenHint: true } } },
    });
    if (!row) return;
    await tx.tournamentZalo.deleteMany({ where: { tournamentId } });
    await recordAudit(tx, {
      actor: { type: "USER", userId },
      action: AUDIT_ACTIONS.ZALO_BOT_REMOVED,
      entityType: "TOURNAMENT",
      entityId: tournamentId,
      tournamentId,
      before: { botName: row.zaloBot.botName, keyHint: row.zaloBot.tokenHint },
    });
  });
}

/** The stored webhook secret, or null when it cannot be read (e.g. ZALO_KEY_SECRET rotated). */
function readSecret(sealed: string): string | null {
  try {
    return decryptSecret(sealed);
  } catch (e) {
    if (e instanceof ZaloSecretError && e.code === "ZALO_KEY_UNREADABLE") return null;
    throw e;
  }
}
