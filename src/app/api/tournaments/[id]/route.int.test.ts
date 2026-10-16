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

const { PATCH } = await import("./route");

const URL_ = "http://localhost:4101/api/tournaments/x";
const HOUR = 60 * 60 * 1000;

function patch(id: string, body: unknown, headers: Record<string, string> = {}) {
  const request = new Request(URL_, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return PATCH(request, { params: Promise.resolve({ id }) });
}

async function signIn(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: "hash", displayName: email } });
  jar.token = (await createSession(user.id)).token;
  return user;
}

/** A published tournament whose season starts `startsInMs` from the real clock. */
async function makeTournament(organizerId: string, startsInMs: number) {
  const seasonStartAt = new Date(Date.now() + startsInMs);
  return db.tournament.create({
    data: {
      organizerId,
      status: "PUBLISHED",
      name: "Autumn Expedition",
      description: "Swim to Ly Son together",
      seasonStartAt,
      seasonEndAt: new Date(seasonStartAt.getTime() + 30 * 24 * HOUR),
      routeId: "route00",
      routeDistanceM: 123_450,
      fastestPaceSecPer100m: 65,
      slowestPaceSecPer100m: 300,
      longestRealisticSwimM: 30_000,
      longestSwimCountedM: 10_000,
      dailyLimitM: 10_000,
      pointsPerKm: 10,
    },
  });
}

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

const stored = (id: string) =>
  db.tournament.findUniqueOrThrow({
    where: { id },
    select: { routeId: true, routeDistanceM: true },
  });
const unchanged = { routeId: "route00", routeDistanceM: 123_450 };

describe("PATCH /api/tournaments/:id", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns 200 with the updated values before the season starts", async () => {
    const user = await signIn("organizer@example.com");
    const t = await makeTournament(user.id, 24 * HOUR);

    const res = await patch(t.id, { routeId: "route01", routeDistanceKm: "80.5" });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      tournament: { id: t.id, routeId: "route01", routeDistanceKm: 80.5 },
    });
    await expect(stored(t.id)).resolves.toEqual({ routeId: "route01", routeDistanceM: 80_500 });
  });

  it("returns 409 ROUTE_LOCKED after the season start and changes nothing", async () => {
    const user = await signIn("organizer@example.com");
    const t = await makeTournament(user.id, -HOUR);

    const res = await patch(t.id, { routeDistanceKm: 50 });

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("ROUTE_LOCKED");
    await expect(stored(t.id)).resolves.toEqual(unchanged);
  });

  it("returns 403 for a signed-in user who is not the organizer", async () => {
    const organizer = await db.user.create({
      data: { email: "organizer@example.com", passwordHash: "hash", displayName: "Org" },
    });
    const t = await makeTournament(organizer.id, 24 * HOUR);
    await signIn("other@example.com");

    const res = await patch(t.id, { routeDistanceKm: 50 });

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    await expect(stored(t.id)).resolves.toEqual(unchanged);
  });

  it("returns 404 for an unknown tournament", async () => {
    await signIn("organizer@example.com");

    const res = await patch("missing", { routeDistanceKm: 50 });

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("returns 401 without a session", async () => {
    const organizer = await db.user.create({
      data: { email: "organizer@example.com", passwordHash: "hash", displayName: "Org" },
    });
    const t = await makeTournament(organizer.id, 24 * HOUR);

    const res = await patch(t.id, { routeDistanceKm: 50 });

    expect(res.status).toBe(401);
    await expect(stored(t.id)).resolves.toEqual(unchanged);
  });

  it("returns 400 for an invalid distance or an unknown field", async () => {
    const user = await signIn("organizer@example.com");
    const t = await makeTournament(user.id, 24 * HOUR);

    const invalid = await patch(t.id, { routeDistanceKm: "-1" });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { routeDistanceKm: "ROUTE_DISTANCE_NOT_POSITIVE" },
    });

    const unknown = await patch(t.id, { routeDistanceKm: 50, status: "ACTIVE" });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: { status: "UNKNOWN_FIELD" },
    });
    await expect(stored(t.id)).resolves.toEqual(unchanged);
  });

  it("returns 400 INVALID_BODY for a non-JSON body", async () => {
    const user = await signIn("organizer@example.com");
    const t = await makeTournament(user.id, 24 * HOUR);

    const res = await patch(t.id, "not json");

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_BODY");
  });

  it("rejects a cross-site request", async () => {
    const user = await signIn("organizer@example.com");
    const t = await makeTournament(user.id, 24 * HOUR);

    const res = await patch(t.id, { routeDistanceKm: 50 }, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN_ORIGIN");
    await expect(stored(t.id)).resolves.toEqual(unchanged);
  });
});
