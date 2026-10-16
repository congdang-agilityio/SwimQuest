import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { removeSubscription, saveSubscription } from "@/server/push/subscriptions";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));

const { GET, POST, DELETE } = await import("./route");

const url = "http://localhost/api/me/push-subscriptions";
const send = (method: "POST" | "DELETE", body: unknown, headers: Record<string, string> = {}) => {
  const init = {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
  return (method === "POST" ? POST : DELETE)(new Request(url, init));
};
const sub = (n: string, auth = "a") => ({
  endpoint: `https://push.example.com/${n}`,
  keys: { p256dh: `p-${n}`, auth },
});

async function clean() {
  await db.pushSubscription.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}
async function makeUser(n: string) {
  return db.user.create({
    data: { email: `${n}@example.com`, passwordHash: "h", displayName: n },
  });
}
async function signIn(n: string) {
  const u = await makeUser(n);
  jar.token = (await createSession(u.id)).token;
  return u;
}

describe("push subscriptions", () => {
  beforeEach(async () => {
    jar.token = undefined;
    vi.stubEnv("VAPID_PUBLIC_KEY", "pubkey");
    await clean();
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await clean();
    await db.$disconnect();
  });

  describe("storage", () => {
    it("saves, re-saves by endpoint and removes one device only", async () => {
      const me = await makeUser("me");
      await saveSubscription(me.id, sub("one"));
      await saveSubscription(me.id, sub("one", "new-auth"));
      await saveSubscription(me.id, sub("two"));
      const rows = await db.pushSubscription.findMany({ orderBy: { endpoint: "asc" } });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ userId: me.id, auth: "new-auth" });
      await removeSubscription(me.id, sub("one").endpoint);
      const left = await db.pushSubscription.findMany();
      expect(left.map((r) => r.endpoint)).toEqual([sub("two").endpoint]);
    });

    it("moves an endpoint owned by another user to the caller", async () => {
      const a = await makeUser("a");
      const b = await makeUser("b");
      await saveSubscription(a.id, sub("shared"));
      await saveSubscription(b.id, sub("shared"));
      const rows = await db.pushSubscription.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(b.id);
    });

    it("does not remove another user's subscription", async () => {
      const a = await makeUser("a");
      const b = await makeUser("b");
      await saveSubscription(a.id, sub("x"));
      await removeSubscription(b.id, sub("x").endpoint);
      expect(await db.pushSubscription.count()).toBe(1);
    });

    it("rejects a non-https endpoint", async () => {
      const me = await makeUser("me");
      await expect(
        saveSubscription(me.id, { ...sub("x"), endpoint: "http://push.example.com/x" }),
      ).rejects.toThrow();
      expect(await db.pushSubscription.count()).toBe(0);
    });
  });

  describe("routes", () => {
    it("returns 401 when signed out", async () => {
      for (const res of [await GET(), await send("POST", sub("x")), await send("DELETE", {})]) {
        expect(res.status).toBe(401);
        expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("GET returns the VAPID public key, 503 when unset", async () => {
      await signIn("me");
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ publicKey: "pubkey" });
      vi.stubEnv("VAPID_PUBLIC_KEY", "");
      expect((await GET()).status).toBe(503);
    });

    it("POST saves for the current user and DELETE removes only that endpoint", async () => {
      const me = await signIn("me");
      expect((await send("POST", sub("one"))).status).toBe(200);
      expect((await send("POST", sub("one"))).status).toBe(200);
      expect((await send("POST", sub("two"))).status).toBe(200);
      expect(await db.pushSubscription.count({ where: { userId: me.id } })).toBe(2);
      expect((await send("DELETE", { endpoint: sub("one").endpoint })).status).toBe(200);
      const left = await db.pushSubscription.findMany();
      expect(left.map((r) => r.endpoint)).toEqual([sub("two").endpoint]);
    });

    it("POST returns 400 for http endpoints, missing keys or a bad body", async () => {
      await signIn("me");
      const http = await send("POST", { ...sub("x"), endpoint: "http://push.example.com/x" });
      expect(http.status).toBe(400);
      expect((await http.json()).error.code).toBe("VALIDATION_FAILED");
      expect((await send("POST", { endpoint: sub("x").endpoint })).status).toBe(400);
      expect((await send("POST", "not json")).status).toBe(400);
      expect((await send("DELETE", {})).status).toBe(400);
      expect(await db.pushSubscription.count()).toBe(0);
    });

    it("returns 403 for a cross-site request", async () => {
      await signIn("me");
      const res = await send("POST", sub("x"), { "sec-fetch-site": "cross-site" });
      expect(res.status).toBe(403);
    });
  });
});
