import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startFakeZalo, type FakeZalo } from "../../../tests/fake-zalo";
import { getMe, sendMessage, setWebhook, ZALO_TEXT_LIMIT, ZaloApiError } from "./client";

const KEY = "1234567890:SECRET-bot-key-value";

let fake: FakeZalo;

/** Runs `fn`, expects a ZaloApiError and checks that nothing in it leaks the key or URL. */
async function expectSafeError(fn: () => Promise<unknown>): Promise<ZaloApiError> {
  const error = await fn().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ZaloApiError);
  const err = error as ZaloApiError;
  const dump = [err.message, String(err), err.stack ?? "", JSON.stringify(err)].join("\n");
  expect(dump).not.toContain(KEY);
  expect(dump).not.toContain("SECRET-bot-key");
  expect(dump).not.toContain(`/bot`);
  expect(err.cause).toBeUndefined();
  return err;
}

describe("zalo client", () => {
  beforeAll(async () => {
    fake = await startFakeZalo();
  });
  afterAll(async () => {
    await fake.close();
  });
  beforeEach(() => {
    vi.stubEnv("ZALO_BOT_API_URL", fake.url);
    fake.calls.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("getMe posts JSON to <url>/bot<key>/getMe and returns the bot", async () => {
    fake.answer("getMe", {
      body: { ok: true, result: { id: "42", account_name: "swimbot", display_name: "Swim" } },
    });
    await expect(getMe(KEY)).resolves.toEqual({
      id: "42",
      account_name: "swimbot",
      display_name: "Swim",
    });
    expect(fake.calls).toEqual([{ key: KEY, method: "getMe", body: {} }]);
  });

  it("uses the default Zalo URL when ZALO_BOT_API_URL is not set", async () => {
    vi.stubEnv("ZALO_BOT_API_URL", undefined);
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, result: {} })));
    await getMe(KEY);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe(`https://bot-api.zaloplatforms.com/bot${KEY}/getMe`);
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
  });

  it("a rejected key throws ZaloApiError with Zalo's code, without the key", async () => {
    fake.answer("getMe", {
      status: 401,
      body: { ok: false, error_code: 401, description: `Unauthorized bot ${KEY}` },
    });
    const err = await expectSafeError(() => getMe(KEY));
    expect(err.code).toBe(401);
  });

  it("an ok:false answer with HTTP 200 throws ZaloApiError", async () => {
    fake.answer("getMe", { body: { ok: false, error_code: 400, description: "Bad Request" } });
    const err = await expectSafeError(() => getMe(KEY));
    expect(err.code).toBe(400);
    expect(err.message).toContain("Bad Request");
  });

  it("a non-JSON error answer uses the HTTP status as the code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("oops", { status: 502 }));
    const err = await expectSafeError(() => getMe(KEY));
    expect(err.code).toBe(502);
  });

  it("a timeout throws ZaloApiError with code 0", async () => {
    fake.answer("getMe", "hang");
    const err = await expectSafeError(() => getMe(KEY, { timeoutMs: 50 }));
    expect(err.code).toBe(0);
  });

  it("a network failure throws ZaloApiError with code 0 and no key or URL", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError(`fetch failed: ${fake.url}/bot${KEY}/getMe`),
    );
    const err = await expectSafeError(() => getMe(KEY));
    expect(err.code).toBe(0);
  });

  it("setWebhook sends the url and secret token", async () => {
    fake.answer("setWebhook", { body: { ok: true, result: { url: "https://x.test/hook" } } });
    await setWebhook(KEY, "https://x.test/hook", "hook-secret");
    expect(fake.calls).toEqual([
      {
        key: KEY,
        method: "setWebhook",
        body: { url: "https://x.test/hook", secret_token: "hook-secret" },
      },
    ]);
  });

  it("sendMessage sends chat_id and text and returns the message id", async () => {
    fake.answer("sendMessage", { body: { ok: true, result: { message_id: "m1" } } });
    await expect(sendMessage(KEY, "chat-1", "Xin chào")).resolves.toEqual({ message_id: "m1" });
    expect(fake.calls[0]).toEqual({
      key: KEY,
      method: "sendMessage",
      body: { chat_id: "chat-1", text: "Xin chào" },
    });
  });

  it("sendMessage clips text longer than 2000 characters", async () => {
    await sendMessage(KEY, "chat-1", "a".repeat(2500));
    const sent = (fake.calls[0].body as { text: string }).text;
    expect(ZALO_TEXT_LIMIT).toBe(2000);
    expect(sent).toHaveLength(2000);
    expect(sent.endsWith("…")).toBe(true);
  });

  it("sendMessage keeps text of exactly 2000 characters", async () => {
    const text = "b".repeat(2000);
    await sendMessage(KEY, "chat-1", text);
    expect((fake.calls[0].body as { text: string }).text).toBe(text);
  });
});
