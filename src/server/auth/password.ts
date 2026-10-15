import argon2 from "argon2";

/** argon2id cost, pinned so a library upgrade cannot change it silently (64 MiB per hash). */
export const ARGON2_MEMORY_COST_KIB = 65536;
export const ARGON2_TIME_COST = 3;
export const ARGON2_PARALLELISM = 4;

/** Hashes a password with argon2id (random salt, pinned cost parameters). */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: ARGON2_MEMORY_COST_KIB,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
  });
}

/** True only when `password` matches `hash`; a malformed hash counts as no match. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
