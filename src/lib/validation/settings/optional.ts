import { z } from "zod";

export const OPTIONAL_LIMITS = {
  rulesUrl: 2000,
  eligibilityNotes: 1000,
  contactChannel: 200,
  rulesText: 5000,
} as const;

/** Trims; blank clears the field (null). Non-strings are rejected with `invalid`. */
const optionalText = (max: number, tooLong: string, invalid: string) =>
  z
    .unknown()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === null) return null;
      if (typeof v !== "string") {
        ctx.addIssue({ code: "custom", message: invalid });
        return z.NEVER;
      }
      const text = v.trim();
      if (text.length > max) {
        ctx.addIssue({ code: "custom", message: tooLong });
        return z.NEVER;
      }
      return text || null;
    });

const isHttpUrl = (text: string) => {
  try {
    const { protocol } = new URL(text);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const rulesUrl = optionalText(OPTIONAL_LIMITS.rulesUrl, "INVALID_URL", "INVALID_URL").refine(
  (v) => v === null || isHttpUrl(v),
  { error: "INVALID_URL" },
);

const imageId = z
  .unknown()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === null || (typeof v === "string" && !v.trim())) return null;
    if (typeof v !== "string") {
      ctx.addIssue({ code: "custom", message: "IMAGE_INVALID" });
      return z.NEVER;
    }
    return v.trim();
  });

/**
 * S-31 optional tournament fields (FR-26): banner and logo image ids (kind and ownership are
 * checked by the save), rules link (http or https only), eligibility notes, contact channel and
 * written rules. All optional; empty clears the field and never blocks publishing.
 */
export const optionalSettingsSchema = z.strictObject({
  bannerImageId: imageId,
  logoImageId: imageId,
  rulesUrl,
  eligibilityNotes: optionalText(
    OPTIONAL_LIMITS.eligibilityNotes,
    "ELIGIBILITY_NOTES_TOO_LONG",
    "ELIGIBILITY_NOTES_INVALID",
  ),
  contactChannel: optionalText(
    OPTIONAL_LIMITS.contactChannel,
    "CONTACT_CHANNEL_TOO_LONG",
    "CONTACT_CHANNEL_INVALID",
  ),
  rulesText: optionalText(OPTIONAL_LIMITS.rulesText, "RULES_TEXT_TOO_LONG", "RULES_TEXT_INVALID"),
});

export const OPTIONAL_COLUMNS = Object.keys(optionalSettingsSchema.shape);
