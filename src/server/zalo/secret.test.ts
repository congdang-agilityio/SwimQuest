import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, keyHint, ZaloSecretError } from "./secret";

const KEY = "1234567890:abcdefghijklmnopqrstuvwxyz-BOTKEY";

describe("zalo secret", () => {
  beforeEach(() => {
    vi.stubEnv("ZALO_KEY_SECRET", randomBytes(32).toString("base64"));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a bot key", () => {
    const sealed = encryptSecret(KEY);
    expect(sealed).not.toContain(KEY);
    expect(decryptSecret(sealed)).toBe(KEY);
  });

  it("uses a random IV, so the same key encrypts differently each time", () => {
    expect(encryptSecret(KEY)).not.toBe(encryptSecret(KEY));
  });

  it("rejects a tampered ciphertext", () => {
    const sealed = Buffer.from(encryptSecret(KEY), "base64");
    sealed[sealed.length - 1] ^= 0x01;
    expect(() => decryptSecret(sealed.toString("base64"))).toThrow(ZaloSecretError);
  });

  it("rejects a ciphertext sealed with another secret", () => {
    const sealed = encryptSecret(KEY);
    vi.stubEnv("ZALO_KEY_SECRET", randomBytes(32).toString("base64"));
    expect(() => decryptSecret(sealed)).toThrow(ZaloSecretError);
  });

  it("rejects a truncated ciphertext", () => {
    expect(() => decryptSecret("AAAA")).toThrow(ZaloSecretError);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["too short", randomBytes(16).toString("base64")],
    ["too long", randomBytes(48).toString("base64")],
    ["not base64", "!".repeat(44)],
  ])("throws ZALO_NOT_CONFIGURED when the secret is %s", (_label, value) => {
    vi.stubEnv("ZALO_KEY_SECRET", value);
    expect(() => encryptSecret(KEY)).toThrow(
      expect.objectContaining({ code: "ZALO_NOT_CONFIGURED" }),
    );
    expect(() => decryptSecret("AAAA")).toThrow(
      expect.objectContaining({ code: "ZALO_NOT_CONFIGURED" }),
    );
  });

  it("keyHint returns only the last 4 characters", () => {
    expect(keyHint(KEY)).toBe("TKEY");
    expect(keyHint(KEY)).toHaveLength(4);
  });

  it("keyHint reveals nothing for a key of 4 characters or fewer", () => {
    expect(keyHint("abcd")).toBe("");
    expect(keyHint("")).toBe("");
  });
});
