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

const { PUT } = await import("./route");

function req(body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (teamId: string) => ({ params: Promise.resolve({ teamId }) });

async function signIn(id: string) {
  jar.token = (await createSession(id)).token;
}
const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function setup() {
  const organizer = await user("organizer");
  const captain = await user("captain");
  const member = await user("member");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({
    data: {
      tournamentId: tournament.id,
      name: "Sharks",
      emblemKey: "dolphin",
      memberLimit: 5,
      captainUserId: captain.id,
    },
  });
  for (const u of [captain, member])
    await db.teamMember.create({
      data: { teamId: team.id, tournamentId: tournament.id, userId: u.id, status: "ACTIVE" },
    });
  return { captain, member, team };
}

describe("PUT /api/teams/:teamId/start", () => {
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

  it("saves the captain's choice (200) and reports no change on a repeat", async () => {
    const { captain, team } = await setup();
    await signIn(captain.id);
    const res = await PUT(req({ destination: "son_thuy" }), ctx(team.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ destination: "son_thuy", changed: true });
    expect((await db.team.findUniqueOrThrow({ where: { id: team.id } })).startDestination).toBe(
      "son_thuy",
    );
    const again = await PUT(req({ destination: "son_thuy" }), ctx(team.id));
    expect(await again.json()).toEqual({ destination: "son_thuy", changed: false });
  });

  it("returns 422 INVALID_START for the finish, an unknown or a missing destination", async () => {
    const { captain, team } = await setup();
    await signIn(captain.id);
    for (const body of [
      { destination: "ly_son" },
      { destination: "nope" },
      {},
      { destination: 5 },
    ]) {
      const res = await PUT(req(body), ctx(team.id));
      expect(res.status).toBe(422);
      expect((await res.json()).error.code).toBe("INVALID_START");
    }
  });

  it("returns 400 INVALID_BODY for a non-JSON object body", async () => {
    const { captain, team } = await setup();
    await signIn(captain.id);
    const res = await PUT(
      new Request("http://localhost/api/x", { method: "PUT", body: "x" }),
      ctx(team.id),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_BODY");
  });

  it("returns 401 without a session", async () => {
    const { team } = await setup();
    const res = await PUT(req({ destination: "son_thuy" }), ctx(team.id));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a member who is not the captain", async () => {
    const { member, team } = await setup();
    await signIn(member.id);
    const res = await PUT(req({ destination: "son_thuy" }), ctx(team.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(
      (await db.team.findUniqueOrThrow({ where: { id: team.id } })).startDestination,
    ).toBeNull();
  });

  it("returns 404 for an unknown team", async () => {
    const { captain } = await setup();
    await signIn(captain.id);
    const res = await PUT(req({ destination: "son_thuy" }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 403 FORBIDDEN_ORIGIN for a cross-site request", async () => {
    const { captain, team } = await setup();
    await signIn(captain.id);
    const res = await PUT(
      req({ destination: "son_thuy" }, { origin: "http://evil.example" }),
      ctx(team.id),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN_ORIGIN");
  });
});
