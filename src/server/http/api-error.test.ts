import { describe, expect, it } from "vitest";
import { apiError } from "./api-error";

describe("apiError", () => {
  it("returns the status and a { error: { code, message } } body", async () => {
    const res = apiError(403, "FORBIDDEN_ORIGIN");

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "FORBIDDEN_ORIGIN", message: expect.any(String) } });
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  it("includes per-field codes when given", async () => {
    const res = apiError(400, "VALIDATION_FAILED", { email: "EMAIL_INVALID" });

    expect((await res.json()).error.fields).toEqual({ email: "EMAIL_INVALID" });
  });

  it("does not cache error responses", () => {
    expect(apiError(400, "INVALID_BODY").headers.get("cache-control")).toBe("no-store");
  });
});
