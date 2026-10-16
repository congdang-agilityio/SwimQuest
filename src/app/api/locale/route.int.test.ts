import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { DEFAULT_LOCALE, resolveLocale } from "@/i18n/load-messages";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));

const { PUT } = await import("./route");

const put = (body: unknown, headers: Record<string, string> = {}) =>
  PUT(
    new Request("http://localhost/api/locale", {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const localeCookie = (res: Response) =>
  res.headers.getSetCookie().find((c) => c.startsWith("NEXT_LOCALE="));

async function clean() {
  await db.session.deleteMany();
  await db.user.deleteMany();
}

describe("PUT /api/locale", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("signed out: only sets the 1-year cookie", async () => {
    const res = await put({ locale: "en" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locale: "en" });
    const cookie = localeCookie(res);
    expect(cookie).toContain("NEXT_LOCALE=en");
    expect(cookie).toContain("Max-Age=31536000");
    expect(await db.user.count()).toBe(0);
  });

  it("signed in: sets the cookie and stores User.locale", async () => {
    const u = await db.user.create({
      data: { email: "a@example.com", passwordHash: "h", displayName: "A" },
    });
    jar.token = (await createSession(u.id)).token;
    const res = await put({ locale: "en" });
    expect(res.status).toBe(200);
    expect(localeCookie(res)).toContain("NEXT_LOCALE=en");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).locale).toBe("en");
    await put({ locale: "vi" });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).locale).toBe("vi");
  });

  it.each([{ locale: "fr" }, { locale: 1 }, {}, { locale: null }, null])(
    "rejects %j with 400 and sets no cookie",
    async (body) => {
      const res = await put(body);
      expect(res.status).toBe(400);
      expect(localeCookie(res)).toBeUndefined();
    },
  );

  it("rejects a non-JSON body and a foreign origin", async () => {
    expect((await put("nope")).status).toBe(400);
    expect((await put({ locale: "en" }, { origin: "http://evil.example" })).status).toBe(403);
  });

  it("a first-time visitor without the cookie resolves to Vietnamese", () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe("vi");
  });
});
