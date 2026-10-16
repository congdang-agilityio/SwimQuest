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

const { GET } = await import("./route");

async function clean() {
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

const req = () => new Request("http://localhost/api/x");
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

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
  const swim = (sha: string) =>
    db.swim.create({
      data: {
        userId: player.id,
        source: "GPX",
        fileSha256: sha.repeat(64),
        originalFilename: "swim.gpx",
        startedAt: new Date("2026-06-02T06:00:00+07:00"),
        endedAt: new Date("2026-06-02T06:55:00+07:00"),
        distanceM: 1000,
        durationS: 3300,
        swimType: "OPEN_WATER",
        sport: "swimming",
        isSwim: true,
        track: [{ lat: 10.1, lon: 106.1 }],
      },
    });
  const flagged = await db.swimResult.create({
    data: {
      swimId: (await swim("a")).id,
      tournamentId: t.id,
      teamId: team.id,
      userId: player.id,
      status: "FLAGGED",
      reasons: ["PACE_TOO_SLOW"],
    },
  });
  await db.swimResult.create({
    data: {
      swimId: (await swim("b")).id,
      tournamentId: t.id,
      teamId: team.id,
      userId: player.id,
      status: "VERIFIED",
      reasons: [],
    },
  });
  await signInAs(organizer.id);
  return { organizer, player, t, flagged };
}

describe("GET /api/tournaments/:id/review", () => {
  it("returns 200 { items } with only the flagged swims, no track and no email", async () => {
    const { t, flagged, player } = await setup();
    const res = await GET(req(), ctx(t.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      resultId: flagged.id,
      player: { id: player.id, displayName: "player" },
      distanceM: 1000,
      durationS: 3300,
      swimType: "OPEN_WATER",
      reasons: [{ code: "PACE_TOO_SLOW", value: 330 }],
    });
    expect(body.items[0]).not.toHaveProperty("track");
    expect(JSON.stringify(body)).not.toContain("@example.com");
  });

  it("returns 403 FORBIDDEN for a non-reviewer", async () => {
    const { t, player } = await setup();
    await signInAs(player.id);
    const res = await GET(req(), ctx(t.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("returns 401 without a session", async () => {
    const { t } = await setup();
    jar.token = undefined;
    const res = await GET(req(), ctx(t.id));
    expect(res.status).toBe(401);
  });

  it("returns 404 NOT_FOUND for an unknown tournament", async () => {
    await setup();
    const res = await GET(req(), ctx("missing"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });
});
