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

const { GET } = await import("./route");

const req = (query = "") => new Request(`http://localhost/api/admin/users${query}`);

async function user(name: string, isPlatformAdmin = false) {
  const email = `${name.toLowerCase()}@example.com`;
  return db.user.create({
    data: { email, passwordHash: "secret-hash", displayName: name, isPlatformAdmin },
  });
}
async function signIn(u: { id: string }) {
  jar.token = (await createSession(u.id)).token;
}

async function clean() {
  jar.token = undefined;
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

describe("GET /api/admin/users", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns 200 with matching users for a platform admin, without password hashes", async () => {
    const admin = await user("Admin", true);
    const lan = await user("Lan");
    await user("Minh");
    await signIn(admin);

    const res = await GET(req("?q=LAN"));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({
      items: [
        {
          id: lan.id,
          displayName: "Lan",
          email: "lan@example.com",
          status: "ACTIVE",
          isPlatformAdmin: false,
          createdAt: lan.createdAt.toISOString(),
        },
      ],
      nextCursor: null,
    });
    expect(JSON.stringify(body)).not.toContain("secret-hash");
  });

  it("lists everyone for an empty q", async () => {
    const admin = await user("Admin", true);
    await user("Lan");
    await signIn(admin);

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect((await res.json()).items).toHaveLength(2);
  });

  it("returns 401 without a session", async () => {
    const res = await GET(req("?q=a"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 for a signed-in user who is not a platform admin", async () => {
    const plain = await user("Plain");
    await signIn(plain);

    const res = await GET(req("?q=a"));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("returns 400 VALIDATION_FAILED for an invalid cursor or a too long q", async () => {
    const admin = await user("Admin", true);
    await signIn(admin);

    const badCursor = await GET(req("?cursor=nope"));
    expect(badCursor.status).toBe(400);
    expect((await badCursor.json()).error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { cursor: "INVALID_CURSOR" },
    });

    const longQ = await GET(req(`?q=${"a".repeat(101)}`));
    expect(longQ.status).toBe(400);
    expect((await longQ.json()).error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { q: "TOO_LONG" },
    });
  });
});
