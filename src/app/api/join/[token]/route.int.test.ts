import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
const race = vi.hoisted(() => ({ on: false }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sq_session" && jar.token !== undefined ? { name, value: jar.token } : undefined,
  }),
}));
// Simulates the P2002 race: joinTeam refuses with ALREADY_MEMBER and no team attached.
vi.mock("@/server/join/join-team", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/join/join-team")>();
  return {
    ...actual,
    joinTeam: (...args: Parameters<typeof actual.joinTeam>) => {
      if (race.on) return Promise.reject(new actual.JoinError("ALREADY_MEMBER"));
      return actual.joinTeam(...args);
    },
  };
});

const { POST } = await import("./route");

const TOKEN = "t".repeat(43);

function req(body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (token: string) => ({ params: Promise.resolve({ token }) });

async function signIn(id: string) {
  jar.token = (await createSession(id)).token;
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
const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function setup(status: "PUBLISHED" | "DRAFT" = "PUBLISHED") {
  const organizer = await user("organizer");
  const player = await user("player");
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      name: "Cup",
      description: "d",
      status,
      inviteToken: TOKEN,
      seasonStartAt: new Date("2099-11-01T06:00:00+07:00"),
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  const mk = (name: string, memberLimit: number) =>
    db.team.create({
      data: { tournamentId: tournament.id, name, emblemKey: "dolphin", memberLimit },
    });
  return { organizer, player, tournament, team: await mk("Sharks", 5), other: await mk("Rays", 1) };
}

describe("POST /api/join/:token", () => {
  beforeEach(async () => {
    jar.token = undefined;
    race.on = false;
    await clean();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("joins the session user to the chosen team (200 { teamId })", async () => {
    const { player, team } = await setup();
    await signIn(player.id);
    const res = await POST(req({ teamId: team.id, userId: "someone-else" }), ctx(TOKEN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ teamId: team.id });
    const members = await db.teamMember.findMany({ where: { teamId: team.id } });
    expect(members.map((m) => m.userId)).toEqual([player.id]);
  });

  it("answers 200 alreadyMember with the current team when already in this tournament", async () => {
    const { player, team, other } = await setup();
    await signIn(player.id);
    await POST(req({ teamId: team.id }), ctx(TOKEN));
    const res = await POST(req({ teamId: other.id }), ctx(TOKEN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ teamId: team.id, alreadyMember: true });
  });

  it("looks up the current team when ALREADY_MEMBER carries none (P2002 race)", async () => {
    const { player, tournament, team, other } = await setup();
    await db.teamMember.create({
      data: { teamId: team.id, tournamentId: tournament.id, userId: player.id },
    });
    await signIn(player.id);
    race.on = true;
    const res = await POST(req({ teamId: other.id }), ctx(TOKEN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ teamId: team.id, alreadyMember: true });
  });

  it("answers 409 TEAM_FULL when the team has no free place", async () => {
    const { player, tournament, other, organizer } = await setup();
    await db.teamMember.create({
      data: { teamId: other.id, tournamentId: tournament.id, userId: organizer.id },
    });
    await signIn(player.id);
    const res = await POST(req({ teamId: other.id }), ctx(TOKEN));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("TEAM_FULL");
  });

  it("answers 403 REMOVED_FROM_TOURNAMENT for a player removed after the start", async () => {
    const { player, tournament, team, other } = await setup();
    await db.teamMember.create({
      data: {
        teamId: other.id,
        tournamentId: tournament.id,
        userId: player.id,
        status: "REMOVED",
        endReason: "REMOVED_AFTER_START",
        endedAt: new Date(),
      },
    });
    await signIn(player.id);
    const res = await POST(req({ teamId: team.id }), ctx(TOKEN));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("REMOVED_FROM_TOURNAMENT");
  });

  it("answers 410 JOIN_CLOSED when joining is closed", async () => {
    const { player, team } = await setup("DRAFT");
    await signIn(player.id);
    const res = await POST(req({ teamId: team.id }), ctx(TOKEN));
    expect(res.status).toBe(410);
    expect((await res.json()).error.code).toBe("JOIN_CLOSED");
  });

  it("answers 404 for an unknown token, an unknown team or a missing teamId", async () => {
    const { player, team } = await setup();
    await signIn(player.id);
    for (const [token, body] of [
      ["unknown-token", { teamId: team.id }],
      [TOKEN, { teamId: "nope" }],
      [TOKEN, {}],
    ] as const) {
      const res = await POST(req(body), ctx(token));
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe("NOT_FOUND");
    }
  });

  it("answers 401 when signed out and 400 for a bad body", async () => {
    const { player, team } = await setup();
    expect((await POST(req({ teamId: team.id }), ctx(TOKEN))).status).toBe(401);
    await signIn(player.id);
    const bad = new Request("http://localhost/api/x", { method: "POST", body: "x" });
    expect((await POST(bad, ctx(TOKEN))).status).toBe(400);
    expect(await db.teamMember.count()).toBe(0);
  });

  it("rejects cross-site requests (403)", async () => {
    const { player, team } = await setup();
    await signIn(player.id);
    const res = await POST(req({ teamId: team.id }, { origin: "http://evil.example" }), ctx(TOKEN));
    expect(res.status).toBe(403);
  });
});
