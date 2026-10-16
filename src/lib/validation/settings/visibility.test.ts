import { describe, expect, it } from "vitest";
import { visibilitySettingsSchema } from "./visibility";

const errorOf = (input: unknown) => {
  const r = visibilitySettingsSchema.safeParse(input);
  return r.success ? null : r.error.issues[0];
};

describe("visibilitySettingsSchema", () => {
  it("accepts PUBLIC and INVITE_ONLY", () => {
    for (const visibility of ["PUBLIC", "INVITE_ONLY"]) {
      expect(visibilitySettingsSchema.parse({ visibility })).toEqual({ visibility });
    }
  });

  it("rejects a missing, unknown or non-string value", () => {
    for (const input of [{}, { visibility: "" }, { visibility: "public" }, { visibility: null }]) {
      expect(errorOf(input)).not.toBeNull();
    }
    expect(errorOf({ visibility: "nope" })?.message).toBe("VISIBILITY_INVALID");
  });

  it("rejects unknown keys", () => {
    expect(errorOf({ visibility: "PUBLIC", extra: 1 })?.code).toBe("unrecognized_keys");
  });
});
