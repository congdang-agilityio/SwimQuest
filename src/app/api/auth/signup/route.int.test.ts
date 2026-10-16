import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { findValidSession } from "@/server/auth/session";
import { POST } from "./route";

const URL_ = "http://localhost:4102/api/auth/signup";
const valid = { email: "Lan@Example.com", password: "correct horse", displayName: "Lan" };

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function sessionCookie(res: Response) {
  return res.headers.getSetCookie().find((c) => c.startsWith("sq_session="));
}

/** Cookie attributes (without the name=value pair), lower-cased. */
function attributes(cookie: string) {
  return cookie
    .split(";")
    .slice(1)
    .map((part) => part.trim().toLowerCase());
}

describe("POST /api/auth/signup", () => {
  beforeEach(async () => {
    await db.$executeRaw`TRUNCATE "AuditEvent"`;
    await db.session.deleteMany();
    await db.user.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates the account and returns 201 with the public user", async () => {
    const res = await POST(request(valid));

    expect(res.status).toBe(201);
    const body = await res.json();
    const stored = await db.user.findUniqueOrThrow({ where: { email: "lan@example.com" } });
    expect(body).toEqual({ user: { id: stored.id, displayName: "Lan" } });
    expect(stored.status).toBe("ACTIVE");
  });

  it("signs the user in with an httpOnly, SameSite=Lax session cookie valid for 30 days", async () => {
    const res = await POST(request(valid));

    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    const token = cookie!.split(";")[0].slice("sq_session=".length);
    const session = await findValidSession(token);
    expect(session?.user.email).toBe("lan@example.com");
    const attrs = attributes(cookie!);
    expect(attrs).toContain("httponly");
    expect(attrs).toContain("samesite=lax");
    expect(attrs).toContain("path=/");
    expect(attrs).toContain(`max-age=${30 * 24 * 60 * 60}`);
    expect(attrs).not.toContain("secure");
  });

  it("marks the cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = await POST(request(valid));

    expect(res.status).toBe(201);
    expect(attributes(sessionCookie(res)!)).toContain("secure");
  });

  it.each([
    ["email", { ...valid, email: "not-an-email" }, "EMAIL_INVALID"],
    ["email", { password: valid.password, displayName: valid.displayName }, "EMAIL_REQUIRED"],
    ["password", { ...valid, password: "short" }, "PASSWORD_TOO_SHORT"],
    ["password", { ...valid, password: "" }, "PASSWORD_REQUIRED"],
    ["displayName", { ...valid, displayName: "   " }, "DISPLAY_NAME_REQUIRED"],
    ["displayName", { ...valid, displayName: "x".repeat(41) }, "DISPLAY_NAME_TOO_LONG"],
  ])("returns 400 VALIDATION_FAILED for an invalid %s (%s)", async (field, body, fieldCode) => {
    const res = await POST(request(body));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(typeof json.error.message).toBe("string");
    expect(json.error.fields).toEqual({ [field]: fieldCode });
    expect(sessionCookie(res)).toBeUndefined();
    await expect(db.user.count()).resolves.toBe(0);
  });

  it("returns per-field codes for every invalid field at once", async () => {
    const res = await POST(request({}));

    expect(res.status).toBe(400);
    expect((await res.json()).error.fields).toEqual({
      email: "EMAIL_REQUIRED",
      password: "PASSWORD_REQUIRED",
      displayName: "DISPLAY_NAME_REQUIRED",
    });
  });

  it("returns 409 EMAIL_TAKEN for an existing email, without a cookie or a second account", async () => {
    await POST(request(valid));

    const res = await POST(request({ ...valid, email: "LAN@example.com", displayName: "Other" }));

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatchObject({ code: "EMAIL_TAKEN", fields: { email: "EMAIL_TAKEN" } });
    expect(sessionCookie(res)).toBeUndefined();
    await expect(db.user.count()).resolves.toBe(1);
    await expect(db.session.count()).resolves.toBe(1);
  });

  it("rejects malformed JSON with 400 INVALID_BODY", async () => {
    const res = await POST(request("{not json"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_BODY");
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("rejects a non-JSON content type with 400 INVALID_BODY", async () => {
    const res = await POST(
      request(new URLSearchParams(valid).toString(), {
        "content-type": "application/x-www-form-urlencoded",
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_BODY");
    await expect(db.user.count()).resolves.toBe(0);
  });

  it("rejects a JSON body that is not an object as a validation failure", async () => {
    const res = await POST(request(["a"]));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a cross-site Origin with 403 FORBIDDEN_ORIGIN and creates nothing", async () => {
    const res = await POST(request(valid, { origin: "https://evil.example" }));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN_ORIGIN");
    expect(sessionCookie(res)).toBeUndefined();
    await expect(db.user.count()).resolves.toBe(0);
  });

  it("rejects an Origin of null with 403", async () => {
    const res = await POST(request(valid, { origin: "null" }));

    expect(res.status).toBe(403);
  });

  it("rejects a request the browser marks as cross-site with 403", async () => {
    const res = await POST(request(valid, { "sec-fetch-site": "cross-site" }));

    expect(res.status).toBe(403);
  });

  it("accepts a same-origin Origin header", async () => {
    const res = await POST(request(valid, { origin: "http://localhost:4102" }));

    expect(res.status).toBe(201);
  });

  it("accepts the public host behind a proxy (x-forwarded-host)", async () => {
    const res = await POST(
      request(valid, {
        origin: "https://web-staging.example",
        "x-forwarded-host": "web-staging.example",
      }),
    );

    expect(res.status).toBe(201);
  });
});
