import { db } from "@/server/db";

/** Known one-time moment kinds; a key is `<prefix><id>`. */
const PREFIXES = ["tier:", "finish:", "finish-lost:", "chest:"] as const;
const MAX_KEY_LENGTH = 100;

/** True for a string key with a known prefix, something after it, and a sane length. */
export function isValidMomentKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    key.length <= MAX_KEY_LENGTH &&
    PREFIXES.some((p) => key.startsWith(p) && key.length > p.length)
  );
}

function assertKey(key: string): void {
  if (!isValidMomentKey(key)) throw new Error("Invalid moment key.");
}

/** Whether the user has already seen this moment. */
export async function hasSeen(userId: string, key: string): Promise<boolean> {
  assertKey(key);
  return (await db.seenMoment.count({ where: { userId, key } })) > 0;
}

/** The given keys the user has not seen yet, in the given order. */
export async function unseenKeys(userId: string, keys: readonly string[]): Promise<string[]> {
  keys.forEach(assertKey);
  if (keys.length === 0) return [];
  const rows = await db.seenMoment.findMany({
    where: { userId, key: { in: [...keys] } },
    select: { key: true },
  });
  const seen = new Set(rows.map((r) => r.key));
  return keys.filter((k) => !seen.has(k));
}

/** Records the moment as seen. Idempotent: marking twice keeps the first `seenAt`. */
export async function markSeen(userId: string, key: string): Promise<void> {
  assertKey(key);
  await db.seenMoment.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key },
    update: {},
  });
}
