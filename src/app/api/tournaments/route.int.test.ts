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

const { POST } = await import("./route");

const valid = {
  name: "Autumn Expedition",
  description: "Swim to Ly Son together",
  seasonStart: { date: "2026-11-01", time: "00:00" },
  seasonEnd: { date: "2026-11-30", time: "23:59" },
  routeId: "route01",
  routeDistanceKm: "123.45",
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:4102/api/tournaments", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function signIn(email = "org@example.com") {
  const user = await db.user.create({
    data: { email, passwordHash: "hash", displayName: email },
  });
  jar.token = (await createSession(user.id)).token;
  return user;
}

describe("POST /api/tournaments", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await db.teamMember.deleteMany();
    await db.team.deleteMany();
    await db.tournament.deleteMany();
    await db.auditEvent.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates a draft organized by the session user and returns 201 { id }", async () => {
    const user = await signIn();
    const res = await POST(request(valid));

    expect(res.status).toBe(201);
    const body = await res.json();
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: body.id } });
    expect(body).toEqual({ id: stored.id });
    expect(stored.organizerId).toBe(user.id);
    expect(stored.status).toBe("DRAFT");
  });

  it("returns 400 VALIDATION_FAILED with field codes when the season end is not after the start", async () => {
    await signIn();
    const res = await POST(request({ ...valid, seasonEnd: valid.seasonStart }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fields).toEqual({ seasonEnd: "SEASON_END_NOT_AFTER_START" });
    expect(await db.tournament.count()).toBe(0);
  });

  it("returns 401 UNAUTHENTICATED when not signed in", async () => {
    const res = await POST(request(valid));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(await db.tournament.count()).toBe(0);
  });

  it("ignores an organizerId in the body", async () => {
    const user = await signIn();
    const other = await db.user.create({
      data: { email: "other@example.com", passwordHash: "hash", displayName: "Other" },
    });
    const res = await POST(request({ ...valid, organizerId: other.id }));

    expect(res.status).toBe(201);
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: (await res.json()).id } });
    expect(stored.organizerId).toBe(user.id);
  });

  it("returns 400 INVALID_BODY for a body that is not JSON", async () => {
    await signIn();
    const res = await POST(request("not json"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_BODY");
  });

  it("returns 403 FORBIDDEN_ORIGIN for a cross-site request", async () => {
    await signIn();
    const res = await POST(request(valid, { origin: "https://evil.example" }));

    expect(res.status).toBe(403);
    expect(await db.tournament.count()).toBe(0);
  });
});
