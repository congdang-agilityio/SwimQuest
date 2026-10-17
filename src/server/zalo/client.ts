/** An error answer from the Zalo Bot API, or a network failure / timeout (code 0). */
export class ZaloApiError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "ZaloApiError";
  }
}

export interface ZaloBotInfo {
  id: string;
  account_name: string;
  display_name?: string;
}

export interface ZaloCallOptions {
  /** Request timeout; 10 s by default. */
  timeoutMs?: number;
}

/** Zalo caps a message at 2000 characters. */
export const ZALO_TEXT_LIMIT = 2000;
const DEFAULT_API_URL = "https://bot-api.zaloplatforms.com";
const TIMEOUT_MS = 10_000;

type ZaloAnswer<T> = { ok?: boolean; result?: T; error_code?: number; description?: string };

/** Removes the key from text that came from outside (Zalo's answer), so it never reaches logs. */
function redact(text: string, key: string): string {
  return key ? text.split(key).join("***") : text;
}

/**
 * POSTs JSON to `<ZALO_BOT_API_URL>/bot<key>/<method>` (Telegram-style). Errors never carry
 * the key, the URL holding it, or the underlying error as `cause`.
 */
async function call<T>(
  key: string,
  method: string,
  body: Record<string, unknown>,
  options: ZaloCallOptions = {},
): Promise<T> {
  const base = (process.env.ZALO_BOT_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/bot${key}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
    });
  } catch (e) {
    const reason = e instanceof Error && e.name === "TimeoutError" ? "timed out" : "unreachable";
    throw new ZaloApiError(0, `Zalo ${method} failed: ${reason}`);
  }
  let json: ZaloAnswer<T> | null = null;
  try {
    json = (await res.json()) as ZaloAnswer<T>;
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new ZaloApiError(0, `Zalo ${method} failed: timed out`);
    }
    json = null;
  }
  if (!res.ok || !json?.ok) {
    const code = typeof json?.error_code === "number" ? json.error_code : res.status;
    const detail = typeof json?.description === "string" ? json.description : `HTTP ${res.status}`;
    throw new ZaloApiError(code, redact(`Zalo ${method} failed: ${detail}`, key));
  }
  return json.result as T;
}

function clip(text: string): string {
  return text.length <= ZALO_TEXT_LIMIT ? text : `${text.slice(0, ZALO_TEXT_LIMIT - 1)}…`;
}

/** Checks a key: resolves with the bot's details, or throws (e.g. 401 for a rejected key). */
export function getMe(key: string, options?: ZaloCallOptions): Promise<ZaloBotInfo> {
  return call<ZaloBotInfo>(key, "getMe", {}, options);
}

export function setWebhook(
  key: string,
  url: string,
  secretToken: string,
  options?: ZaloCallOptions,
): Promise<unknown> {
  return call(key, "setWebhook", { url, secret_token: secretToken }, options);
}

/** Posts text to a chat; text longer than 2000 characters is clipped. */
export function sendMessage(
  key: string,
  chatId: string,
  text: string,
  options?: ZaloCallOptions,
): Promise<{ message_id: string }> {
  return call(key, "sendMessage", { chat_id: chatId, text: clip(text) }, options);
}
