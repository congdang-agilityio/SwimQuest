import { z } from "zod";
import { db } from "@/server/db";
import {
  PUSH_CATEGORIES,
  type PushCategory,
  type PushPreferences,
} from "@/lib/notification-preferences";

/** Partial update body: `{ MILESTONES: false }`. Unknown keys are rejected. */
export const pushPreferencesPatch = z
  .object(Object.fromEntries(PUSH_CATEGORIES.map((c) => [c, z.boolean().optional()])))
  .strict()
  .refine((v) => Object.keys(v).length > 0, "EMPTY");

function toPreferences(off: readonly string[]): PushPreferences {
  return Object.fromEntries(PUSH_CATEGORIES.map((c) => [c, !off.includes(c)])) as PushPreferences;
}

/** The player's push switches (account-wide, so the same on every device); null if no user. */
export async function getPushPreferences(userId: string): Promise<PushPreferences | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { pushOffCategories: true },
  });
  return user ? toPreferences(user.pushOffCategories) : null;
}

export type SetPushPreferencesResult =
  { ok: true; push: PushPreferences } | { ok: false; error: "VALIDATION_FAILED" | "NOT_FOUND" };

/** Applies a partial update of the push switches and returns all of them. */
export async function setPushPreferences(
  userId: string,
  patch: unknown,
): Promise<SetPushPreferencesResult> {
  const parsed = pushPreferencesPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "VALIDATION_FAILED" };
  const current = await getPushPreferences(userId);
  if (!current) return { ok: false, error: "NOT_FOUND" };
  const next = { ...current, ...parsed.data } as PushPreferences;
  const off = PUSH_CATEGORIES.filter((c) => !next[c]);
  await db.user.update({ where: { id: userId }, data: { pushOffCategories: off } });
  return { ok: true, push: next };
}

/** Whether a notification of this category may be pushed to a player with these switches. */
export function pushAllowed(pushOffCategories: readonly string[], category: PushCategory): boolean {
  return !pushOffCategories.includes(category);
}

/**
 * For the push sender (#385): marks every pending notification (pushedAt null) whose category
 * its recipient switched off as handled, so it is never pushed or retried. The notification row
 * stays and still shows in the in-app list. Call it before picking the notifications to send.
 * Returns how many were skipped.
 */
export async function skipSwitchedOffPushes(): Promise<number> {
  return db.$executeRaw`
    UPDATE "Notification" n
    SET "pushedAt" = now()
    FROM "User" u
    WHERE n."userId" = u.id
      AND n."pushedAt" IS NULL
      AND n.category = ANY(u."pushOffCategories")`;
}
