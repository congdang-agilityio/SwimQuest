import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { createSession } from "@/server/auth/session";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));

const { PUT } = await import("./route");

function req(body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/admin/users/x/role", {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}
const ctx = (userId: string) => ({ params: Promise.resolve({ userId }) });

async function user(name: string, isPlatformAdmin = false) {
  const email = `${name.toLowerCase()}@example.com`;
  return db.user.create({
    data: { email, passwordHash: "secret-hash", displayName: name, isPlatformAdmin },
  });
}
async function signIn(u: { id: string }) {
  jar.token = (await createSession(u.id)).token;
}
const isAdmin = async (id: string) =>
  (await db.user.findUniqueOrThrow({ where: { id } })).isPlatformAdmin;
const roleAudits = () => db.auditEvent.count({ where: { action: "ADMIN_ROLE_CHANGED" } });

async function clean() {
  jar.token = undefined;
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

describe("PUT /api/admin/users/:userId/role", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns 200 and grants the admin role with an audit event, without password hashes", async () => {
    const admin = await user("Admin", true);
    const lan = await user("Lan");
    await signIn(admin);

    const res = await PUT(req({ isPlatformAdmin: true }), ctx(lan.id));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({
      id: lan.id,
      displayName: "Lan",
      email: "lan@example.com",
      status: "ACTIVE",
      isPlatformAdmin: true,
      createdAt: lan.createdAt.toISOString(),
    });
    expect(JSON.stringify(body)).not.toContain("secret-hash");
    expect(await isAdmin(lan.id)).toBe(true);
    expect(await roleAudits()).toBe(1);
  });

  it("returns 200 and removes the admin role from another admin", async () => {
    const admin = await user("Admin", true);
    const other = await user("Other", true);
    await signIn(admin);

    const res = await PUT(req({ isPlatformAdmin: false }), ctx(other.id));

    expect(res.status).toBe(200);
    expect((await res.json()).isPlatformAdmin).toBe(false);
    expect(await isAdmin(other.id)).toBe(false);
  });

  it("returns 401 without a session", async () => {
    const lan = await user("Lan");
    const res = await PUT(req({ isPlatformAdmin: true }), ctx(lan.id));
    expect(res.status).toBe(401);
    expect(await isAdmin(lan.id)).toBe(false);
  });

  it("returns 403 for a signed-in user who is not a platform admin", async () => {
    const plain = await user("Plain");
    await signIn(plain);

    const res = await PUT(req({ isPlatformAdmin: true }), ctx(plain.id));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(await isAdmin(plain.id)).toBe(false);
    expect(await roleAudits()).toBe(0);
  });

  it("returns 403 for a cross-site request", async () => {
    const admin = await user("Admin", true);
    const lan = await user("Lan");
    await signIn(admin);

    const res = await PUT(
      req({ isPlatformAdmin: true }, { origin: "http://evil.example" }),
      ctx(lan.id),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN_ORIGIN");
    expect(await isAdmin(lan.id)).toBe(false);
  });

  it("returns 409 LAST_ADMIN when the last admin removes their own role", async () => {
    const admin = await user("Admin", true);
    await signIn(admin);

    const res = await PUT(req({ isPlatformAdmin: false }), ctx(admin.id));

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("LAST_ADMIN");
    expect(await isAdmin(admin.id)).toBe(true);
    expect(await roleAudits()).toBe(0);
  });

  it("returns 404 for an unknown user", async () => {
    const admin = await user("Admin", true);
    await signIn(admin);

    const res = await PUT(req({ isPlatformAdmin: true }), ctx("missing"));

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for a non-object body or a missing boolean", async () => {
    const admin = await user("Admin", true);
    const lan = await user("Lan");
    await signIn(admin);

    const notJson = await PUT(req("not json"), ctx(lan.id));
    expect(notJson.status).toBe(400);
    expect((await notJson.json()).error.code).toBe("INVALID_BODY");

    const notBool = await PUT(req({ isPlatformAdmin: "yes" }), ctx(lan.id));
    expect(notBool.status).toBe(400);
    expect((await notBool.json()).error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { isPlatformAdmin: "BOOLEAN_REQUIRED" },
    });
    expect(await isAdmin(lan.id)).toBe(false);
  });
});
