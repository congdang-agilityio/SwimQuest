import { z } from "zod";
import { DEFAULT_AVATAR_KEYS } from "@/lib/default-avatars";
import { isRegionCode } from "@/lib/regions";

export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 300;

export type ProfileErrorCode =
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_TOO_LONG"
  | "BIO_TOO_LONG"
  | "REGION_UNKNOWN"
  | "AVATAR_UNKNOWN"
  | "IMAGE_INVALID"
  | "UNKNOWN_FIELD";

const code = (error: ProfileErrorCode) => ({ error, abort: true });
const imageId = z
  .string(code("IMAGE_INVALID"))
  .min(1, code("IMAGE_INVALID"))
  .max(64, code("IMAGE_INVALID"));

/**
 * A partial profile change. Strict: any other key (email, role, stats, ...) is refused.
 * `null` clears an optional field. Whether an image id belongs to the user is checked by the service.
 */
export const profileUpdateSchema = z.strictObject(
  {
    displayName: z
      .string(code("DISPLAY_NAME_REQUIRED"))
      .trim()
      .min(1, code("DISPLAY_NAME_REQUIRED"))
      .max(DISPLAY_NAME_MAX, code("DISPLAY_NAME_TOO_LONG"))
      .optional(),
    bio: z
      .string(code("BIO_TOO_LONG"))
      .trim()
      .max(BIO_MAX, code("BIO_TOO_LONG"))
      .nullable()
      .optional(),
    regionCode: z
      .string(code("REGION_UNKNOWN"))
      .refine(isRegionCode, code("REGION_UNKNOWN"))
      .nullable()
      .optional(),
    avatarDefaultKey: z.enum(DEFAULT_AVATAR_KEYS, code("AVATAR_UNKNOWN")).nullable().optional(),
    avatarImageId: imageId.nullable().optional(),
    coverImageId: imageId.nullable().optional(),
  },
  code("UNKNOWN_FIELD"),
);

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type ProfileErrors = Record<string, ProfileErrorCode>;

/** Validates a profile change and returns the first error code of each invalid field. */
export function parseProfileUpdate(
  input: unknown,
): { ok: true; data: ProfileUpdate } | { ok: false; errors: ProfileErrors } {
  const result = profileUpdateSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors: ProfileErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.code === "unrecognized_keys" ? issue.keys[0] : String(issue.path[0] ?? "_");
    errors[key] ??= issue.message as ProfileErrorCode;
  }
  return { ok: false, errors };
}
