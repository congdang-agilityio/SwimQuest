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

const { PUT } = await import("./route");

function req(body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}
const ctx = (teamId: string) => ({ params: Promise.resolve({ teamId }) });

async function signIn(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: "h", displayName: email } });
  jar.token = (await createSession(user.id)).token;
  return user;
}

async function setup() {
  const organizer = await signIn("org@example.com");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status: "PUBLISHED",
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
      name: "Sharks",
      emblemKey: "dolphin",
      description: "Fast",
      memberLimit: 3,
      tournamentId: tournament.id,
    },
  });
  const member = await db.user.create({
    data: { email: "m@example.com", passwordHash: "h", displayName: "m" },
  });
  await db.teamMember.create({
    data: { teamId: team.id, tournamentId: tournament.id, userId: member.id, status: "ACTIVE" },
  });
  return { organizer, team, member };
}

describe("PUT /api/teams/:teamId/captain", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await db.auditEvent.deleteMany();
    await db.teamMember.deleteMany();
    await db.team.deleteMany();
    await db.tournament.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
  });
  afterAll(async () => {
    await db.auditEvent.deleteMany();
    await db.teamMember.deleteMany();
    await db.team.deleteMany();
    await db.tournament.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
    await db.$disconnect();
  });

  it("returns 200 { captainUserId } and stores the captain", async () => {
    const { team, member } = await setup();
    const res = await PUT(req({ userId: member.id }), ctx(team.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ captainUserId: member.id });
    expect((await db.team.findUniqueOrThrow({ where: { id: team.id } })).captainUserId).toBe(
      member.id,
    );
  });

  it("returns 400 INVALID_BODY for a non-object body", async () => {
    const { team } = await setup();
    const res = await PUT(req("not json"), ctx(team.id));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_BODY");
  });

  it("returns 400 VALIDATION_FAILED when userId is missing", async () => {
    const { team } = await setup();
    const res = await PUT(req({}), ctx(team.id));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fields).toEqual({ userId: "USER_REQUIRED" });
  });

  it("returns 401 without a session", async () => {
    const { team, member } = await setup();
    jar.token = undefined;
    const res = await PUT(req({ userId: member.id }), ctx(team.id));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a user who is not the organizer", async () => {
    const { team, member } = await setup();
    jar.token = (await createSession(member.id)).token;
    const res = await PUT(req({ userId: member.id }), ctx(team.id));
    expect(res.status).toBe(403);
    expect((await db.team.findUniqueOrThrow({ where: { id: team.id } })).captainUserId).toBeNull();
  });

  it("returns 403 for a cross-site request", async () => {
    const { team, member } = await setup();
    const res = await PUT(
      req({ userId: member.id }, { origin: "http://evil.example" }),
      ctx(team.id),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown team", async () => {
    const { member } = await setup();
    const res = await PUT(req({ userId: member.id }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 422 NOT_A_MEMBER for a user outside the team", async () => {
    const { team, organizer } = await setup();
    const res = await PUT(req({ userId: organizer.id }), ctx(team.id));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("NOT_A_MEMBER");
  });
});
