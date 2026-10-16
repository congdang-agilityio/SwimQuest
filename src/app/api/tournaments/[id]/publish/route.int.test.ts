import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function post(id: string, headers: Record<string, string> = {}) {
  const request = new Request(`http://localhost:4101/api/tournaments/${id}/publish`, {
    method: "POST",
    headers,
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

async function signIn(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: "hash", displayName: email } });
  jar.token = (await createSession(user.id)).token;
  return user;
}

async function makeDraft(organizerId: string, { withTeam = true } = {}) {
  const tournament = await db.tournament.create({
    data: {
      organizerId,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100_000,
      visibility: "INVITE_ONLY",
    },
  });
  if (withTeam) {
    await db.team.create({
      data: { tournamentId: tournament.id, name: "Sharks", emblemKey: "dolphin", memberLimit: 3 },
    });
  }
  return tournament;
}

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

describe("POST /api/tournaments/:id/publish", () => {
  beforeEach(async () => {
    jar.token = undefined;
    await clean();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("publishes a valid draft and returns the invite URL from the request origin", async () => {
    const organizer = await signIn("o@example.com");
    const t = await makeDraft(organizer.id);
    const res = await post(t.id);
    expect(res.status).toBe(200);
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(stored.status).toBe("PUBLISHED");
    expect(await res.json()).toEqual({
      status: "PUBLISHED",
      inviteUrl: `http://localhost:4101/join/${stored.inviteToken}`,
    });
  });

  it("answers a repeated call with 200 and the same URL", async () => {
    const organizer = await signIn("o@example.com");
    const t = await makeDraft(organizer.id);
    const first = await (await post(t.id)).json();
    const res = await post(t.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(first);
  });

  it("builds the invite URL from APP_URL, ignoring a spoofed forwarded host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://swim.example.com/");
    const organizer = await signIn("o@example.com");
    const t = await makeDraft(organizer.id);
    const res = await post(t.id, {
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "http",
    });
    expect(res.status).toBe(200);
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect((await res.json()).inviteUrl).toBe(
      `https://swim.example.com/join/${stored.inviteToken}`,
    );
  });

  it("returns 500 and leaves the draft untouched in production without APP_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const organizer = await signIn("o@example.com");
    const t = await makeDraft(organizer.id);
    const res = await post(t.id, { "x-forwarded-host": "evil.example" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("evil.example");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("APP_URL"));
    expect((await db.tournament.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("DRAFT");
  });

  it("returns 422 PUBLISH_INVALID with the issues and leaves the draft untouched", async () => {
    const organizer = await signIn("o@example.com");
    const t = await makeDraft(organizer.id, { withTeam: false });
    const res = await post(t.id);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("PUBLISH_INVALID");
    expect(body.error.issues).toEqual([{ code: "NO_TEAM", field: "teams" }]);
    expect((await db.tournament.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("DRAFT");
  });

  it("returns 401 without a session", async () => {
    const organizer = await db.user.create({
      data: { email: "o@example.com", passwordHash: "h", displayName: "o" },
    });
    const t = await makeDraft(organizer.id);
    expect((await post(t.id)).status).toBe(401);
  });

  it("returns 403 for a user who is not the organizer", async () => {
    const organizer = await db.user.create({
      data: { email: "o@example.com", passwordHash: "h", displayName: "o" },
    });
    const t = await makeDraft(organizer.id);
    await signIn("other@example.com");
    const res = await post(t.id);
    expect(res.status).toBe(403);
    expect((await db.tournament.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("DRAFT");
  });

  it("returns 404 for an unknown tournament", async () => {
    await signIn("o@example.com");
    expect((await post("nope")).status).toBe(404);
  });

  it("returns 403 for a cross-site request", async () => {
    const organizer = await signIn("o@example.com");
    const t = await makeDraft(organizer.id);
    expect((await post(t.id, { "sec-fetch-site": "cross-site" })).status).toBe(403);
  });
});
