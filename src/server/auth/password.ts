import argon2 from "argon2";

/** Hashes a password with argon2id (random salt, library default cost). */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** True only when `password` matches `hash`; a malformed hash counts as no match. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
