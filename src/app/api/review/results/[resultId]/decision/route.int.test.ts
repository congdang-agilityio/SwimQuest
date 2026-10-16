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

async function clean() {
  await db.domainEvent.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.notification.deleteMany();
  await db.weeklyResult.deleteMany();
  await db.weekSettlement.deleteMany();
  await db.badge.deleteMany();
  await db.xpWeek.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

beforeEach(async () => {
  jar.token = undefined;
  await clean();
});
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

function req(body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}
const ctx = (resultId: string) => ({ params: Promise.resolve({ resultId }) });

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });
const signInAs = async (id: string) => {
  jar.token = (await createSession(id)).token;
};

async function setup() {
  const organizer = await user("organizer");
  const player = await user("player");
  const t = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Cup",
      description: "d",
      status: "ACTIVE",
      seasonStartAt: new Date("2026-05-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-07-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const team = await db.team.create({
    data: { tournamentId: t.id, name: "Sharks", emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({
    data: { tournamentId: t.id, teamId: team.id, userId: player.id, status: "ACTIVE" },
  });
  const swim = await db.swim.create({
    data: {
      userId: player.id,
      source: "GPX",
      fileSha256: "a".repeat(64),
      originalFilename: "swim.gpx",
      startedAt: new Date("2026-06-02T06:00:00+07:00"),
      endedAt: new Date("2026-06-02T06:55:00+07:00"),
      distanceM: 1000,
      durationS: 3300,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
    },
  });
  const result = await db.swimResult.create({
    data: {
      swimId: swim.id,
      tournamentId: t.id,
      teamId: team.id,
      userId: player.id,
      status: "FLAGGED",
      reasons: ["PACE_TOO_SLOW"],
    },
  });
  await signInAs(organizer.id);
  return { organizer, player, result };
}

const statusOf = async (id: string) =>
  (await db.swimResult.findUniqueOrThrow({ where: { id } })).status;

describe("POST /api/review/results/:resultId/decision", () => {
  it("approves: 200 { resultId, status: VERIFIED }", async () => {
    const { result } = await setup();
    const res = await POST(req({ approve: true }), ctx(result.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ resultId: result.id, status: "VERIFIED" });
    expect(await statusOf(result.id)).toBe("VERIFIED");
  });

  it("rejects with a reason: 200 { status: REJECTED } and stores the note", async () => {
    const { result } = await setup();
    const res = await POST(req({ approve: false, reason: " Boat ride " }), ctx(result.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ resultId: result.id, status: "REJECTED" });
    const row = await db.swimResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(row).toMatchObject({ status: "REJECTED", decisionNote: "Boat ride" });
  });

  it.each([{ approve: false }, { approve: false, reason: "  " }, { approve: false, reason: 7 }])(
    "returns 400 REASON_REQUIRED for a reject without a valid reason (%o)",
    async (body) => {
      const { result } = await setup();
      const res = await POST(req(body), ctx(result.id));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("REASON_REQUIRED");
      expect(await statusOf(result.id)).toBe("FLAGGED");
    },
  );

  it("returns 409 ALREADY_DECIDED on a second decision and keeps the first", async () => {
    const { result } = await setup();
    expect((await POST(req({ approve: true }), ctx(result.id))).status).toBe(200);
    const res = await POST(req({ approve: false, reason: "no" }), ctx(result.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("ALREADY_DECIDED");
    expect(await statusOf(result.id)).toBe("VERIFIED");
  });

  it("returns 403 FORBIDDEN for a non-reviewer (the player) and changes nothing", async () => {
    const { player, result } = await setup();
    await signInAs(player.id);
    const res = await POST(req({ approve: true }), ctx(result.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(await statusOf(result.id)).toBe("FLAGGED");
  });

  it("returns 403 for a non-reviewer even when the reject has no reason", async () => {
    const { player, result } = await setup();
    await signInAs(player.id);
    const res = await POST(req({ approve: false }), ctx(result.id));
    expect(res.status).toBe(403);
  });

  it("returns 403 FORBIDDEN_ORIGIN for a cross-site request", async () => {
    const { result } = await setup();
    const res = await POST(
      req({ approve: true }, { origin: "http://evil.example" }),
      ctx(result.id),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN_ORIGIN");
    expect(await statusOf(result.id)).toBe("FLAGGED");
  });

  it("returns 401 without a session", async () => {
    const { result } = await setup();
    jar.token = undefined;
    const res = await POST(req({ approve: true }), ctx(result.id));
    expect(res.status).toBe(401);
  });

  it("returns 404 NOT_FOUND for an unknown result", async () => {
    await setup();
    const res = await POST(req({ approve: true }), ctx("missing"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it.each(["not json", [], { approve: "yes" }, {}])(
    "returns 400 for a malformed body (%o)",
    async (body) => {
      const { result } = await setup();
      const res = await POST(req(body), ctx(result.id));
      expect(res.status).toBe(400);
      expect(["INVALID_BODY", "VALIDATION_FAILED"]).toContain((await res.json()).error.code);
      expect(await statusOf(result.id)).toBe("FLAGGED");
    },
  );
});
