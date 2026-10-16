import { z } from "zod";
import { db } from "@/server/db";
import {
  PRIVACY_FIELDS,
  PRIVACY_LEVELS,
  resolvePrivacy,
  type PrivacyField,
  type PrivacySettings,
} from "@/lib/privacy";

/** A partial change: only known fields with known levels. `email` has no setting, so it fails. */
const level = z.enum(PRIVACY_LEVELS).optional();
const privacyChangeSchema = z.strictObject(
  Object.fromEntries(PRIVACY_FIELDS.map((field) => [field, level])) as Record<
    PrivacyField,
    typeof level
  >,
);

export type SetPrivacyResult =
  { ok: true; privacy: PrivacySettings } | { ok: false; error: "INVALID_PRIVACY" | "NOT_FOUND" };

/** The player's full privacy settings (defaults filled in), or null for an unknown player. */
export async function getPrivacy(userId: string): Promise<PrivacySettings | null> {
  if (typeof userId !== "string" || !userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { privacy: true } });
  return user ? resolvePrivacy(user.privacy) : null;
}

/** Applies a partial change to the player's privacy settings and returns the full result. */
export async function setPrivacy(userId: string, input: unknown): Promise<SetPrivacyResult> {
  const parsed = privacyChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_PRIVACY" };
  const current = await getPrivacy(userId);
  if (!current) return { ok: false, error: "NOT_FOUND" };
  const changes = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v));
  const privacy = { ...current, ...changes } as PrivacySettings;
  await db.user.update({ where: { id: userId }, data: { privacy } });
  return { ok: true, privacy };
}
