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

const { POST } = await import("../../tournaments/[id]/teams/route");
const { PATCH, DELETE } = await import("./route");

const input = { name: "Sharks", emblemKey: "dolphin", description: "Fast", memberLimit: 3 };

function req(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}
const tid = (id: string) => ({ params: Promise.resolve({ id }) });
const teamCtx = (teamId: string) => ({ params: Promise.resolve({ teamId }) });

async function signIn(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: "h", displayName: email } });
  jar.token = (await createSession(user.id)).token;
  return user;
}

async function setup(status: "DRAFT" | "PUBLISHED" = "DRAFT") {
  const organizer = await signIn("org@example.com");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({ data: { ...input, tournamentId: tournament.id } });
  return { organizer, tournament, team };
}

async function addMember(teamId: string, tournamentId: string, email = "m@example.com") {
  const u = await db.user.create({
    data: { email, passwordHash: "h", displayName: "m" },
  });
  await db.teamMember.create({ data: { teamId, tournamentId, userId: u.id, status: "ACTIVE" } });
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

describe("team management routes", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  describe("POST /api/tournaments/:id/teams", () => {
    it("creates a team and returns 201 { team }", async () => {
      const { tournament } = await setup();
      const res = await POST(req("POST", { ...input, name: "Rays" }), tid(tournament.id));
      expect(res.status).toBe(201);
      const { team } = await res.json();
      expect(team).toMatchObject({ name: "Rays", tournamentId: tournament.id });
      expect(await db.team.count({ where: { name: "Rays" } })).toBe(1);
    });

    it("returns 400 VALIDATION_FAILED with field codes", async () => {
      const { tournament } = await setup();
      const res = await POST(req("POST", { ...input, name: "" }), tid(tournament.id));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(body.error.fields).toEqual({ name: "NAME_REQUIRED" });
    });

    it("returns 400 INVALID_BODY for a non-JSON body", async () => {
      const { tournament } = await setup();
      const res = await POST(req("POST", "not json"), tid(tournament.id));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("INVALID_BODY");
    });

    it("returns 401 when not signed in", async () => {
      const { tournament } = await setup();
      jar.token = undefined;
      const res = await POST(req("POST", input), tid(tournament.id));
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    });

    it("returns 403 FORBIDDEN for a non-organizer and creates nothing", async () => {
      const { tournament } = await setup();
      await signIn("other@example.com");
      const res = await POST(req("POST", { ...input, name: "Rays" }), tid(tournament.id));
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
      expect(await db.team.count({ where: { name: "Rays" } })).toBe(0);
    });

    it("returns 404 for an unknown tournament", async () => {
      await setup();
      const res = await POST(req("POST", input), tid("missing"));
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe("NOT_FOUND");
    });

    it("returns 403 FORBIDDEN_ORIGIN for a cross-site request", async () => {
      const { tournament } = await setup();
      const res = await POST(
        req("POST", input, { origin: "http://evil.example" }),
        tid(tournament.id),
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN_ORIGIN");
    });
  });

  describe("PATCH /api/teams/:teamId", () => {
    it("updates the team and returns 200 { team }", async () => {
      const { team } = await setup();
      const res = await PATCH(req("PATCH", { ...input, name: "Whales" }), teamCtx(team.id));
      expect(res.status).toBe(200);
      expect((await res.json()).team).toMatchObject({ id: team.id, name: "Whales" });
    });

    it("returns 400 VALIDATION_FAILED", async () => {
      const { team } = await setup();
      const res = await PATCH(req("PATCH", { ...input, memberLimit: 0 }), teamCtx(team.id));
      expect(res.status).toBe(400);
      expect((await res.json()).error.fields).toEqual({ memberLimit: "LIMIT_INVALID" });
    });

    it("returns 401 when not signed in", async () => {
      const { team } = await setup();
      jar.token = undefined;
      expect((await PATCH(req("PATCH", input), teamCtx(team.id))).status).toBe(401);
    });

    it("returns 403 for a non-organizer", async () => {
      const { team } = await setup();
      await signIn("other@example.com");
      const res = await PATCH(req("PATCH", { ...input, name: "Whales" }), teamCtx(team.id));
      expect(res.status).toBe(403);
      expect((await db.team.findUniqueOrThrow({ where: { id: team.id } })).name).toBe("Sharks");
    });

    it("returns 404 for an unknown team", async () => {
      await setup();
      expect((await PATCH(req("PATCH", input), teamCtx("missing"))).status).toBe(404);
    });

    it("returns 409 LIMIT_BELOW_MEMBERS when the limit drops below the members", async () => {
      const { team, tournament } = await setup();
      await addMember(team.id, tournament.id);
      await addMember(team.id, tournament.id, "m2@example.com");
      const res = await PATCH(req("PATCH", { ...input, memberLimit: 1 }), teamCtx(team.id));
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("LIMIT_BELOW_MEMBERS");
    });
  });

  describe("DELETE /api/teams/:teamId", () => {
    it("deletes an empty team of a draft tournament with 204", async () => {
      const { team } = await setup();
      const res = await DELETE(req("DELETE"), teamCtx(team.id));
      expect(res.status).toBe(204);
      expect(await db.team.count({ where: { id: team.id } })).toBe(0);
    });

    it("returns 401 when not signed in", async () => {
      const { team } = await setup();
      jar.token = undefined;
      expect((await DELETE(req("DELETE"), teamCtx(team.id))).status).toBe(401);
    });

    it("returns 403 for a non-organizer", async () => {
      const { team } = await setup();
      await signIn("other@example.com");
      expect((await DELETE(req("DELETE"), teamCtx(team.id))).status).toBe(403);
      expect(await db.team.count({ where: { id: team.id } })).toBe(1);
    });

    it("returns 404 for an unknown team", async () => {
      await setup();
      expect((await DELETE(req("DELETE"), teamCtx("missing"))).status).toBe(404);
    });

    it("returns 409 TEAM_NOT_DELETABLE when the team has members", async () => {
      const { team, tournament } = await setup();
      await addMember(team.id, tournament.id);
      const res = await DELETE(req("DELETE"), teamCtx(team.id));
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("TEAM_NOT_DELETABLE");
    });

    it("returns 409 TEAM_NOT_DELETABLE once the tournament is published", async () => {
      const { team } = await setup("PUBLISHED");
      const res = await DELETE(req("DELETE"), teamCtx(team.id));
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("TEAM_NOT_DELETABLE");
    });
  });
});
