import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logIn } from "@/server/auth/login";
import { hashPassword } from "@/server/auth/password";
import { createSession, findValidSession } from "@/server/auth/session";
import { db } from "@/server/db";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));

const { PUT } = await import("./route");

const OLD = "old password 1";
const NEW = "brand new password";
const EMAIL = "lan@example.com";
const url = "http://localhost/api/me/password";

const put = (body: unknown, headers: Record<string, string> = {}) =>
  PUT(
    new Request(url, {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

async function clean() {
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

async function signIn() {
  const user = await db.user.create({
    data: { email: EMAIL, passwordHash: await hashPassword(OLD), displayName: "Lan" },
  });
  const current = await createSession(user.id);
  const other = await createSession(user.id);
  jar.token = current.token;
  return { user, current, other };
}

const logSpies = () =>
  (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );

describe("PUT /api/me/password", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("changes the password, keeps this session and revokes the others", async () => {
    const { current, other } = await signIn();

    const res = await put({ current: OLD, next: NEW, confirm: NEW });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
    await expect(logIn({ email: EMAIL, password: NEW })).resolves.toMatchObject({ ok: true });
    expect(await findValidSession(current.token)).not.toBeNull();
    expect(await findValidSession(other.token)).toBeNull();
  });

  it("refuses a wrong current password with a 400 on the current field", async () => {
    await signIn();

    const res = await put({ current: "not my password", next: NEW, confirm: NEW });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { current: "WRONG_PASSWORD" },
    });
    await expect(logIn({ email: EMAIL, password: OLD })).resolves.toMatchObject({ ok: true });
  });

  it("refuses mismatched new passwords with a 400 on the confirm field", async () => {
    await signIn();

    const res = await put({ current: OLD, next: NEW, confirm: `${NEW}x` });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { confirm: "PASSWORD_MISMATCH" },
    });
    await expect(logIn({ email: EMAIL, password: OLD })).resolves.toMatchObject({ ok: true });
  });

  it("refuses a new password that breaks the sign-up rule with a 400 on the next field", async () => {
    await signIn();

    const res = await put({ current: OLD, next: "short", confirm: "short" });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fields.next).toMatch(/^PASSWORD_/);
  });

  it("returns 401 when signed out and changes nothing", async () => {
    const { user } = await signIn();
    jar.token = undefined;

    const res = await put({ current: OLD, next: NEW, confirm: NEW });

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toBe(user.passwordHash);
  });

  it("returns 400 INVALID_BODY for a body that is not JSON", async () => {
    await signIn();
    const res = await put("{not json");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_BODY");
  });

  it("refuses a cross-site request with 403", async () => {
    await signIn();
    const res = await put(
      { current: OLD, next: NEW, confirm: NEW },
      { origin: "https://evil.example.com" },
    );
    expect(res.status).toBe(403);
    await expect(logIn({ email: EMAIL, password: OLD })).resolves.toMatchObject({ ok: true });
  });

  it("never logs the request body or the passwords", async () => {
    await signIn();
    const spies = logSpies();

    await put({ current: OLD, next: NEW, confirm: NEW });
    await put({ current: "wrong one 123", next: NEW, confirm: NEW });

    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const secret of [OLD, NEW, "wrong one 123"]) expect(logged).not.toContain(secret);
  });
});
