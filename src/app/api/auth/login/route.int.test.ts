import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { findValidSession } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { DUMMY_PASSWORD_HASH } from "@/server/auth/login";
import { POST } from "./route";

vi.mock("@/server/auth/password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/password")>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

const URL_ = "http://localhost:4102/api/auth/login";
const PASSWORD = "correct horse";
let passwordHash: string;

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

async function makeUser(status: UserStatus = "ACTIVE") {
  return db.user.create({
    data: { email: "lan@example.com", passwordHash, displayName: "Lan", status },
  });
}

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    vi.mocked(verifyPassword).mockClear();
    await db.$executeRaw`TRUNCATE "AuditEvent"`;
    await db.session.deleteMany();
    await db.xpEntry.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("sets NEXT_LOCALE from the saved locale on login", async () => {
    await db.user.create({
      data: { email: "lan@example.com", passwordHash, displayName: "Lan", locale: "en" },
    });
    const res = await POST(request({ email: "lan@example.com", password: PASSWORD }));
    expect(res.status).toBe(200);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("NEXT_LOCALE="));
    expect(cookie).toContain("NEXT_LOCALE=en");
    expect(cookie).toContain("Max-Age=31536000");
  });

  it("sets no NEXT_LOCALE when the user never chose a language (Vietnamese default)", async () => {
    await makeUser();
    const res = await POST(request({ email: "lan@example.com", password: PASSWORD }));
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("NEXT_LOCALE="))).toBe(false);
  });

  it("signs an active user in with 200, the public user and a new session cookie", async () => {
    const user = await makeUser();

    const res = await POST(request({ email: "lan@example.com", password: PASSWORD }));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ user: { id: user.id, displayName: "Lan" } });
    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    const token = cookie!.split(";")[0].slice("sq_session=".length);
    const session = await findValidSession(token);
    expect(session?.user.id).toBe(user.id);
    expect(cookie!.toLowerCase()).toContain("httponly");
  });

  it("matches the email case-insensitively and ignores surrounding spaces", async () => {
    await makeUser();

    const res = await POST(request({ email: "  LAN@Example.COM ", password: PASSWORD }));

    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toBeDefined();
  });

  it("creates a new session on every login", async () => {
    await makeUser();

    await POST(request({ email: "lan@example.com", password: PASSWORD }));
    await POST(request({ email: "lan@example.com", password: PASSWORD }));

    await expect(db.session.count()).resolves.toBe(2);
  });

  it("answers an unknown email and a wrong password with the same 401 body", async () => {
    await makeUser();

    const unknown = await POST(request({ email: "nobody@example.com", password: PASSWORD }));
    const wrong = await POST(request({ email: "lan@example.com", password: "wrong horse" }));

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    const unknownBody = await unknown.json();
    expect(unknownBody).toEqual(await wrong.json());
    expect(unknownBody).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: expect.any(String) },
    });
    expect(sessionCookie(unknown)).toBeUndefined();
    expect(sessionCookie(wrong)).toBeUndefined();
    await expect(db.session.count()).resolves.toBe(0);
  });

  it("still verifies against a dummy hash when the email is unknown", async () => {
    const res = await POST(request({ email: "nobody@example.com", password: PASSWORD }));

    expect(res.status).toBe(401);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(verifyPassword).toHaveBeenCalledWith(DUMMY_PASSWORD_HASH, PASSWORD);
  });

  it("uses a dummy hash with the same argon2id cost as real hashes", () => {
    const params = (hash: string) => hash.split("$").slice(1, 4).join("$");

    expect(params(DUMMY_PASSWORD_HASH)).toBe(params(passwordHash));
  });

  it.each(["DELETION_PENDING", "DELETED"] as const)(
    "gives a %s user with the right password the same 401",
    async (status) => {
      await makeUser(status);

      const res = await POST(request({ email: "lan@example.com", password: PASSWORD }));

      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("INVALID_CREDENTIALS");
      expect(sessionCookie(res)).toBeUndefined();
      await expect(db.session.count()).resolves.toBe(0);
    },
  );

  it.each([
    ["no fields", {}],
    ["a non-string email", { email: 42, password: PASSWORD }],
    ["an empty password", { email: "lan@example.com", password: "" }],
    ["an over-long password", { email: "lan@example.com", password: "x".repeat(129) }],
    ["an array body", ["a"]],
  ])("rejects %s with 400 VALIDATION_FAILED", async (_label, body) => {
    const res = await POST(request(body));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("rejects malformed JSON with 400 INVALID_BODY", async () => {
    const res = await POST(request("{not json"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_BODY");
  });

  it("rejects a cross-site Origin with 403 FORBIDDEN_ORIGIN", async () => {
    await makeUser();

    const res = await POST(
      request({ email: "lan@example.com", password: PASSWORD }, { origin: "https://evil.example" }),
    );

    expect(res.status).toBe(403);
    expect(sessionCookie(res)).toBeUndefined();
  });
});
