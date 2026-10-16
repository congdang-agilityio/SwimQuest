import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createSession, findValidSession } from "@/server/auth/session";
import { POST } from "./route";

const URL_ = "http://localhost:4101/api/auth/logout";

function request(token?: string) {
  const headers: Record<string, string> = token ? { cookie: `sq_session=${token}` } : {};
  return new NextRequest(URL_, { method: "POST", headers });
}

function sessionCookie(res: Response) {
  return res.headers.getSetCookie().find((c) => c.startsWith("sq_session="));
}

async function signedIn() {
  const user = await db.user.create({
    data: { email: "logout@example.com", passwordHash: "hash", displayName: "Logout" },
  });
  return { user, ...(await createSession(user.id)) };
}

describe("POST /api/auth/logout", () => {
  beforeEach(async () => {
    await db.$executeRaw`TRUNCATE "AuditEvent"`;
    await db.session.deleteMany();
    await db.xpEntry.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects a cross-site request and keeps the session", async () => {
    const { token } = await signedIn();
    const res = await POST(
      new NextRequest(URL_, {
        method: "POST",
        headers: { cookie: `sq_session=${token}`, origin: "https://evil.example" },
      }),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN_ORIGIN");
    expect(await findValidSession(token)).not.toBeNull();
  });

  it("deletes the session row and clears the cookie", async () => {
    const { user, token } = await signedIn();
    const other = await createSession(user.id);

    const res = await POST(request(token));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie!.split(";")[0]).toBe("sq_session=");
    expect(cookie!.toLowerCase()).toContain("max-age=0");
    await expect(db.session.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(findValidSession(other.token)).resolves.not.toBeNull();
  });

  it("leaves the user unauthenticated for the next request", async () => {
    const { token } = await signedIn();

    await POST(request(token));

    await expect(findValidSession(token)).resolves.toBeNull();
  });

  it("returns 200 and clears the cookie without a session", async () => {
    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toBeDefined();
  });

  it("returns 200 for an unknown or malformed session token", async () => {
    await signedIn();

    expect((await POST(request("C".repeat(43)))).status).toBe(200);
    expect((await POST(request("garbage"))).status).toBe(200);
    await expect(db.session.count()).resolves.toBe(1);
  });
});
