import { describe, expect, it } from "vitest";
import { parseSignUp, signUpSchema } from "./auth";

const valid = { email: "swimmer@example.com", password: "correct horse", displayName: "Lan" };

function errorsFor(input: Record<string, unknown>) {
  const result = parseSignUp(input);
  return result.ok ? {} : result.errors;
}

describe("sign-up validation", () => {
  it("accepts valid input and normalizes email and display name", () => {
    const result = parseSignUp({
      email: "  Swimmer@Example.COM ",
      password: " pass word ",
      displayName: "  Lan  ",
    });

    expect(result).toEqual({
      ok: true,
      data: { email: "swimmer@example.com", password: " pass word ", displayName: "Lan" },
    });
  });

  it("is a plain Zod schema shared with the client", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    [{ email: undefined }, "EMAIL_REQUIRED"],
    [{ email: 42 }, "EMAIL_REQUIRED"],
    [{ email: "" }, "EMAIL_REQUIRED"],
    [{ email: "   " }, "EMAIL_REQUIRED"],
    [{ email: "not-an-email" }, "EMAIL_INVALID"],
    [{ email: "a@b" }, "EMAIL_INVALID"],
    [{ email: `${"a".repeat(243)}@example.com` }, "EMAIL_TOO_LONG"],
  ])("rejects email %j with %s", (patch, code) => {
    expect(errorsFor({ ...valid, ...patch })).toEqual({ email: code });
  });

  it("accepts an email of exactly 254 characters", () => {
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com`;
    expect(email).toHaveLength(254);
    expect(errorsFor({ ...valid, email })).toEqual({});
  });

  it.each([
    [{ password: undefined }, "PASSWORD_REQUIRED"],
    [{ password: "" }, "PASSWORD_REQUIRED"],
    [{ password: "1234567" }, "PASSWORD_TOO_SHORT"],
    [{ password: "x".repeat(129) }, "PASSWORD_TOO_LONG"],
    [{ password: "         " }, "PASSWORD_BLANK"],
  ])("rejects password %j with %s", (patch, code) => {
    expect(errorsFor({ ...valid, ...patch })).toEqual({ password: code });
  });

  it("accepts passwords of 8 and 128 characters", () => {
    expect(errorsFor({ ...valid, password: "12345678" })).toEqual({});
    expect(errorsFor({ ...valid, password: "x".repeat(128) })).toEqual({});
  });

  it.each([
    [{ displayName: undefined }, "DISPLAY_NAME_REQUIRED"],
    [{ displayName: "" }, "DISPLAY_NAME_REQUIRED"],
    [{ displayName: "    " }, "DISPLAY_NAME_REQUIRED"],
    [{ displayName: "x".repeat(41) }, "DISPLAY_NAME_TOO_LONG"],
  ])("rejects display name %j with %s", (patch, code) => {
    expect(errorsFor({ ...valid, ...patch })).toEqual({ displayName: code });
  });

  it("accepts a display name of 40 characters after trimming", () => {
    expect(errorsFor({ ...valid, displayName: ` ${"x".repeat(40)} ` })).toEqual({});
  });

  it("reports one error code per invalid field", () => {
    expect(errorsFor({})).toEqual({
      email: "EMAIL_REQUIRED",
      password: "PASSWORD_REQUIRED",
      displayName: "DISPLAY_NAME_REQUIRED",
    });
  });

  it.each([
    ["null", null],
    ["an empty array", []],
    ["an array holding a valid object", [valid]],
    ["a string", "user@example.com"],
    ["a number", 42],
  ])("rejects input that is not a plain object: %s", (_label, input) => {
    expect(errorsFor(input as unknown as Record<string, unknown>)).toEqual({
      email: "EMAIL_REQUIRED",
      password: "PASSWORD_REQUIRED",
      displayName: "DISPLAY_NAME_REQUIRED",
    });
  });
});
