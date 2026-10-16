import { z } from "zod";

export const VISIBILITY_VALUES = ["PUBLIC", "INVITE_ONLY"] as const;

/** S-30 visibility (FR-25): "Public" or "Invite link only"; no default, so a choice is required. */
export const visibilitySettingsSchema = z.strictObject({
  visibility: z.enum(VISIBILITY_VALUES, { error: "VISIBILITY_INVALID" }),
});
