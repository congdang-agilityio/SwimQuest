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

const { GET } = await import("./route");

const get = (qs = "") => GET(new Request(`http://localhost/api/me/swims${qs}`));

async function clean() {
  await db.swim.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}
async function signIn(n: string) {
  const u = await db.user.create({
    data: { email: `${n}@example.com`, passwordHash: "h", displayName: n },
  });
  jar.token = (await createSession(u.id)).token;
  return u;
}
const addSwims = (userId: string, count: number) =>
  db.swim.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId,
      source: "GPX" as const,
      swimType: "OPEN_WATER" as const,
      startedAt: new Date(Date.UTC(2026, 0, 1 + i)),
      distanceM: 1000 + i,
      durationS: 600,
      fileSha256: `${userId}-${i}`,
      originalFilename: "swim.gpx",
      endedAt: new Date(Date.UTC(2026, 0, 1 + i, 1)),
      sport: "swimming",
      isSwim: true,
    })),
  });

describe("GET /api/me/swims", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns 401 when signed out", async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the first page of only my swims, newest first", async () => {
    const me = await signIn("me");
    const other = await db.user.create({
      data: { email: "o@example.com", passwordHash: "h", displayName: "o" },
    });
    await addSwims(me.id, 3);
    await addSwims(other.id, 2);
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((s: { distanceM: number }) => s.distanceM)).toEqual([1002, 1001, 1000]);
    expect(body.nextCursor).toBeNull();
  });

  it("pages with nextCursor and ignores a userId parameter", async () => {
    const me = await signIn("me");
    await addSwims(me.id, 22);
    const first = await (await get("?userId=someone-else")).json();
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await (await get(`?cursor=${encodeURIComponent(first.nextCursor)}`)).json();
    expect(second.items.map((s: { distanceM: number }) => s.distanceM)).toEqual([1001, 1000]);
    expect(second.nextCursor).toBeNull();
  });

  it.each(["garbage", "", "x".repeat(300)])("returns 400 for invalid cursor %j", async (c) => {
    await signIn("me");
    const res = await get(`?cursor=${c}`);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
  });
});
