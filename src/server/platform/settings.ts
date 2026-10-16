import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** The stored value of a platform setting, or `fallback` when none is stored. */
export async function getSetting<T>(
  key: string,
  fallback: T,
  client: Pick<Tx, "platformSetting"> = db,
): Promise<Prisma.JsonValue | T> {
  const row = await client.platformSetting.findUnique({ where: { key } });
  return row ? row.value : fallback;
}

/** Serializes writers of one setting until the transaction ends (read old, then write). */
export async function lockSetting(tx: Tx, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`platform-setting:${key}`}))`;
}

/** Stores a platform setting and who changed it. Call inside the audited transaction. */
export async function setSetting(
  tx: Tx,
  key: string,
  value: Prisma.InputJsonValue,
  userId: string,
): Promise<void> {
  const data = { value, updatedById: userId };
  await tx.platformSetting.upsert({ where: { key }, create: { key, ...data }, update: data });
}
