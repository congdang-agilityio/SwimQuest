import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));

const { POST } = await import("./route");

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/me/moments", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

async function clean() {
  await db.seenMoment.deleteMany();
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}
async function signIn(n: string) {
  const u = await db.user.create({
    data: { email: `${n}@example.com`, passwordHash: "h", displayName: n },
  });
  jar.token = (await createSession(u.id)).token;
  return u;
}

describe("POST /api/me/moments", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns 401 when signed out", async () => {
    const res = await post({ key: "tier:a" });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("marks a moment seen for the current user, idempotently", async () => {
    const me = await signIn("me");
    expect((await post({ key: "finish:t1" })).status).toBe(200);
    expect((await post({ key: "finish:t1" })).status).toBe(200);
    const rows = await db.seenMoment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: me.id, key: "finish:t1" });
  });

  it("returns 400 for an unknown prefix, a missing key or a bad body", async () => {
    await signIn("me");
    const bad = await post({ key: "bogus:1" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("VALIDATION_FAILED");
    expect((await post({})).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect(await db.seenMoment.count()).toBe(0);
  });

  it("returns 403 for a cross-site request", async () => {
    await signIn("me");
    const res = await post({ key: "tier:a" }, { "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
  });
});
