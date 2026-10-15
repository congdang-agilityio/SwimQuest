import { z } from "zod";

/**
 * Sign-up rules (A-27, Team Lead proposal), shared by the client form and the server.
 * Every issue message is an error code; the UI translates codes into labelled messages.
 */
export type SignUpErrorCode =
  | "EMAIL_REQUIRED"
  | "EMAIL_INVALID"
  | "EMAIL_TOO_LONG"
  | "EMAIL_TAKEN"
  | "PASSWORD_REQUIRED"
  | "PASSWORD_BLANK"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_TOO_LONG";

const code = (error: SignUpErrorCode) => ({ error, abort: true });

/** Trimmed and lower-cased; at most 254 characters. */
export const emailSchema = z
  .string(code("EMAIL_REQUIRED"))
  .trim()
  .toLowerCase()
  .min(1, code("EMAIL_REQUIRED"))
  .max(254, code("EMAIL_TOO_LONG"))
  .pipe(z.email(code("EMAIL_INVALID")));

/** 8 to 128 characters, not only whitespace; never trimmed. */
export const passwordSchema = z
  .string(code("PASSWORD_REQUIRED"))
  .min(1, code("PASSWORD_REQUIRED"))
  .refine((value) => value.trim().length > 0, code("PASSWORD_BLANK"))
  .min(8, code("PASSWORD_TOO_SHORT"))
  .max(128, code("PASSWORD_TOO_LONG"));

/** Trimmed, 1 to 40 characters; not unique. */
export const displayNameSchema = z
  .string(code("DISPLAY_NAME_REQUIRED"))
  .trim()
  .min(1, code("DISPLAY_NAME_REQUIRED"))
  .max(40, code("DISPLAY_NAME_TOO_LONG"));

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignUpField = keyof SignUpInput;
export type SignUpErrors = Partial<Record<SignUpField, SignUpErrorCode>>;

/** Validates sign-up input and returns the first error code of each invalid field. */
export function parseSignUp(
  input: unknown,
): { ok: true; data: SignUpInput } | { ok: false; errors: SignUpErrors } {
  const result = signUpSchema.safeParse(input && typeof input === "object" ? input : {});
  if (result.success) return { ok: true, data: result.data };
  const errors: SignUpErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as SignUpField;
    errors[field] ??= issue.message as SignUpErrorCode;
  }
  return { ok: false, errors };
}
