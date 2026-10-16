import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { SESSION_COOKIE } from "./cookie";
import { createSession } from "./session";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { getCurrentUser, requireApiUser, requireUser } = await import("./current-user");

const DAY = 24 * 60 * 60 * 1000;

async function makeUser(email = "current@example.com") {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: "Current" } });
}

async function expiredToken(userId: string) {
  const { token } = await createSession(userId, new Date(Date.now() - 31 * DAY));
  return token;
}

describe("current user", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await db.$executeRaw`TRUNCATE "AuditEvent"`;
    await db.session.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("uses the session cookie name", () => {
    expect(SESSION_COOKIE).toBe("sq_session");
  });

  describe("getCurrentUser", () => {
    it("returns id, displayName and isPlatformAdmin for a valid session", async () => {
      const user = await makeUser();
      jar.token = (await createSession(user.id)).token;

      await expect(getCurrentUser()).resolves.toEqual({
        id: user.id,
        displayName: "Current",
        isPlatformAdmin: false,
      });
    });

    it("returns null without a session cookie", async () => {
      await expect(getCurrentUser()).resolves.toBeNull();
    });

    it("returns null for an unknown session token", async () => {
      jar.token = "A".repeat(43);
      await expect(getCurrentUser()).resolves.toBeNull();
    });

    it("returns null for a malformed session token", async () => {
      jar.token = "not a token";
      await expect(getCurrentUser()).resolves.toBeNull();
    });

    it("returns null for an expired session", async () => {
      const user = await makeUser();
      jar.token = await expiredToken(user.id);
      await expect(getCurrentUser()).resolves.toBeNull();
    });

    it("returns null when the user is no longer ACTIVE", async () => {
      const user = await makeUser();
      jar.token = (await createSession(user.id)).token;
      await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
      await expect(getCurrentUser()).resolves.toBeNull();
    });
  });

  describe("requireUser", () => {
    it("returns the user for a valid session", async () => {
      const user = await makeUser();
      jar.token = (await createSession(user.id)).token;

      await expect(requireUser("/home")).resolves.toMatchObject({ id: user.id });
    });

    it("redirects to /login with the requested path when there is no session", async () => {
      await expect(requireUser("/tournaments/1?tab=team")).rejects.toThrow(
        `REDIRECT:/login?next=${encodeURIComponent("/tournaments/1?tab=team")}`,
      );
    });

    it("treats an expired session exactly like no session", async () => {
      const user = await makeUser();
      jar.token = await expiredToken(user.id);
      await expect(requireUser("/home")).rejects.toThrow("REDIRECT:/login?next=%2Fhome");
    });

    it.each([["https://evil.example"], ["//evil.example"], ["/\\evil.example"], ["home"], [""]])(
      "falls back to / for an unsafe next path %j",
      async (next) => {
        await expect(requireUser(next)).rejects.toThrow("REDIRECT:/login?next=%2F");
        await expect(requireUser(next)).rejects.not.toThrow(/evil|home/);
      },
    );
  });

  describe("requireApiUser", () => {
    it("returns the user for a valid session", async () => {
      const user = await makeUser();
      jar.token = (await createSession(user.id)).token;

      const result = await requireApiUser();

      expect(result.ok).toBe(true);
      expect(result.ok && result.user.id).toBe(user.id);
    });

    it.each([
      ["no session", async () => undefined],
      ["an unknown session", async () => "B".repeat(43)],
      ["an expired session", async () => expiredToken((await makeUser()).id)],
    ])("returns a 401 UNAUTHENTICATED response for %s", async (_label, token) => {
      jar.token = await token();

      const result = await requireApiUser();

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.response.status).toBe(401);
      expect(result.response.headers.get("cache-control")).toBe("no-store");
      const body = await result.response.json();
      expect(body.error.code).toBe("UNAUTHENTICATED");
      expect(typeof body.error.message).toBe("string");
    });
  });
});
