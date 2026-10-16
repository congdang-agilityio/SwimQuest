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

const { GET, PATCH } = await import("./route");

const URL_ = "http://localhost:4102/api/tournaments/x/settings";
const DAY = 24 * 60 * 60 * 1000;

const patch = (id: string, body: unknown) =>
  PATCH(
    new Request(URL_, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
const get = (id: string) => GET(new Request(URL_), { params: Promise.resolve({ id }) });

async function signIn(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: "hash", displayName: email } });
  jar.token = (await createSession(user.id)).token;
  return user;
}

function makeTournament(organizerId: string, status: "PUBLISHED" | "COMPLETED") {
  const start = new Date(Date.now() + 10 * DAY);
  return db.tournament.create({
    data: {
      organizerId,
      status,
      name: "Autumn Expedition",
      description: "Swim to Ly Son together",
      seasonStartAt: start,
      seasonEndAt: new Date(start.getTime() + 30 * DAY),
      routeId: "route01",
      routeDistanceM: 100_000,
    },
  });
}

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const VALUES = { longestSwimCountedKm: "5", dailyLimitKm: "12.5", swimTypeAllowed: "POOL_ONLY" };

describe("/api/tournaments/:id/settings", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("200 saves a group and GET returns it", async () => {
    const org = await signIn("org@example.com");
    const t = await makeTournament(org.id, "PUBLISHED");
    const res = await patch(t.id, { group: "swim", values: VALUES });
    expect(res.status).toBe(200);
    const read = await get(t.id);
    expect(read.status).toBe(200);
    const { settings } = await read.json();
    expect(JSON.stringify(settings)).toContain("POOL_ONLY");
  });

  it("400 for invalid values and an unknown group", async () => {
    const org = await signIn("org@example.com");
    const t = await makeTournament(org.id, "PUBLISHED");
    const bad = await patch(t.id, { group: "swim", values: { dailyLimitKm: "abc" } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("VALIDATION_FAILED");
    const unknown = await patch(t.id, { group: "nope", values: {} });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error.fields.group).toBe("UNKNOWN_GROUP");
  });

  it("403 when not the organizer", async () => {
    const org = await db.user.create({
      data: { email: "o@example.com", passwordHash: "h", displayName: "o" },
    });
    const t = await makeTournament(org.id, "PUBLISHED");
    await signIn("other@example.com");
    expect((await patch(t.id, { group: "swim", values: VALUES })).status).toBe(403);
    expect((await get(t.id)).status).toBe(403);
  });

  it("409 SEASON_LOCKED once the season is over", async () => {
    const org = await signIn("org@example.com");
    const t = await makeTournament(org.id, "COMPLETED");
    const res = await patch(t.id, { group: "swim", values: VALUES });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("SEASON_LOCKED");
  });

  it("401 when signed out", async () => {
    expect((await patch("x", { group: "swim", values: {} })).status).toBe(401);
    expect((await get("x")).status).toBe(401);
  });
});
