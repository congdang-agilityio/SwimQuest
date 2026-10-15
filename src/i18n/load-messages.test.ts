import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, loadMessages, resolveLocale } from "./load-messages";

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "msgs-"));
  for (const locale of ["vi", "en"]) mkdirSync(path.join(dir, locale));
  writeFileSync(path.join(dir, "vi", "common.json"), JSON.stringify({ hello: "Xin chào" }));
  writeFileSync(path.join(dir, "vi", "auth.json"), JSON.stringify({ title: "Đăng ký" }));
  writeFileSync(path.join(dir, "vi", "notes.txt"), "ignored");
  writeFileSync(path.join(dir, "en", "common.json"), JSON.stringify({ hello: "Hello" }));
  return dir;
}

describe("loadMessages", () => {
  it("merges every json file into one object keyed by file name", async () => {
    const dir = fixture();
    expect(await loadMessages("vi", dir)).toEqual({
      common: { hello: "Xin chào" },
      auth: { title: "Đăng ký" },
    });
  });

  it("loads English messages", async () => {
    expect(await loadMessages("en", fixture())).toEqual({ common: { hello: "Hello" } });
  });

  it("falls back to vi for an unknown locale", async () => {
    const msgs = await loadMessages("fr", fixture());
    expect(msgs).toHaveProperty("common.hello", "Xin chào");
  });

  it("ships real vi and en common messages", async () => {
    const vi = await loadMessages("vi");
    const en = await loadMessages("en");
    expect(Object.keys(vi.common as object)).toEqual(Object.keys(en.common as object));
  });
});

describe("resolveLocale", () => {
  it("defaults to vi without a cookie", () => {
    expect(resolveLocale(undefined)).toBe("vi");
    expect(DEFAULT_LOCALE).toBe("vi");
  });
  it("accepts en", () => expect(resolveLocale("en")).toBe("en"));
  it("falls back to vi for unsupported values", () => expect(resolveLocale("de")).toBe("vi"));
});
