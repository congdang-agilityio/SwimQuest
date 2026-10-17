import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type ZaloSecretErrorCode = "ZALO_NOT_CONFIGURED" | "ZALO_KEY_UNREADABLE";

const MESSAGES: Record<ZaloSecretErrorCode, string> = {
  ZALO_NOT_CONFIGURED:
    "ZALO_KEY_SECRET is missing or malformed (expected base64 of 32 bytes, e.g. openssl rand -base64 32)",
  ZALO_KEY_UNREADABLE: "A stored Zalo bot key could not be decrypted",
};

/**
 * The bot-key secret is missing or malformed, or a stored key cannot be decrypted.
 * Messages never carry the secret, the key or the ciphertext.
 */
export class ZaloSecretError extends Error {
  constructor(readonly code: ZaloSecretErrorCode) {
    super(MESSAGES[code]);
    this.name = "ZaloSecretError";
  }
}

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** 32 bytes in standard base64 is exactly 43 characters plus one "=". */
const SECRET_SHAPE = /^[A-Za-z0-9+/]{43}=$/;

/** Reads `ZALO_KEY_SECRET` (base64, 32 bytes) at call time; fails closed when it is not usable. */
function secretKey(): Buffer {
  const raw = process.env.ZALO_KEY_SECRET?.trim() ?? "";
  if (!SECRET_SHAPE.test(raw)) throw new ZaloSecretError("ZALO_NOT_CONFIGURED");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new ZaloSecretError("ZALO_NOT_CONFIGURED");
  return key;
}

/** Encrypts a bot key with AES-256-GCM; returns base64 of `iv | tag | ciphertext`. */
export function encryptSecret(plain: string): string {
  const key = secretKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

/** Decrypts a value from `encryptSecret`; a tampered or foreign value throws `ZALO_KEY_UNREADABLE`. */
export function decryptSecret(sealed: string): string {
  const key = secretKey();
  const data = Buffer.from(sealed, "base64");
  if (data.length <= IV_BYTES + TAG_BYTES) throw new ZaloSecretError("ZALO_KEY_UNREADABLE");
  try {
    const decipher = createDecipheriv(ALGORITHM, key, data.subarray(0, IV_BYTES));
    decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const body = data.subarray(IV_BYTES + TAG_BYTES);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    throw new ZaloSecretError("ZALO_KEY_UNREADABLE");
  }
}

/** The last 4 characters of a key, safe to show; nothing for keys too short to hide. */
export function keyHint(key: string): string {
  return key.length > 4 ? key.slice(-4) : "";
}
