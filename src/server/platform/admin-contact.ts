import { z } from "zod";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { requirePlatformAdmin } from "@/server/auth/roles";
import type { AdminActor } from "@/server/admin/users";
import { getSetting, lockSetting, setSetting } from "./settings";

export const ADMIN_CONTACT_SETTING_KEY = "adminContact";

/** The contact is not text, longer than 200 characters or has control characters. */
export class AdminContactError extends Error {
  readonly status = 400;
  readonly code = "INVALID_ADMIN_CONTACT";
}

// Plain text: line breaks (CRLF from a form post becomes LF) and tabs allowed; other C0/C1
// control characters and bidi overrides (they can visually reorder a phone number) refused.
const contactSchema = z
  .string()
  .transform((s) => s.replace(/\r\n/g, "\n"))
  .pipe(
    z
      .string()
      .trim()
      .max(200)
      .regex(/^[^\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]*$/),
  );

async function readContact(client: Parameters<typeof getSetting>[2]): Promise<string> {
  const stored = await getSetting(ADMIN_CONTACT_SETTING_KEY, "", client);
  return typeof stored === "string" ? stored : "";
}

/** How to reach the platform admin, shown on the login page (S-59 AC 1); "" when not set. */
export async function getAdminContact(): Promise<string> {
  return readContact(db);
}

/**
 * Saves the admin contact (trimmed plain text, at most 200 characters, "" clears it) for an
 * active platform admin (role re-read from the database). A change is audited as
 * `ADMIN_CONTACT_CHANGED` with old and new text in the same transaction; saving the same text
 * again changes and audits nothing. `ForbiddenError` / `AdminContactError` save nothing.
 */
export async function setAdminContact(actor: AdminActor, text: string): Promise<string> {
  return db.$transaction(async (tx) => {
    const id = typeof actor?.id === "string" ? actor.id : "";
    const user = id ? await tx.user.findUnique({ where: { id } }) : null;
    requirePlatformAdmin(user?.status === "ACTIVE" ? user : null);
    const parsed = contactSchema.safeParse(text);
    if (!parsed.success) throw new AdminContactError("INVALID_ADMIN_CONTACT");

    await lockSetting(tx, ADMIN_CONTACT_SETTING_KEY);
    const before = await readContact(tx);
    if (before === parsed.data) return before;
    await setSetting(tx, ADMIN_CONTACT_SETTING_KEY, parsed.data, id);
    await recordAudit(tx, {
      actor: { type: "USER", userId: id },
      action: AUDIT_ACTIONS.ADMIN_CONTACT_CHANGED,
      entityType: "PlatformSetting",
      entityId: ADMIN_CONTACT_SETTING_KEY,
      before: { contact: before },
      after: { contact: parsed.data },
    });
    return parsed.data;
  });
}
