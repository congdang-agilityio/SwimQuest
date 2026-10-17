import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { POST } from "./route";

const SECRET = "test-cron-secret-0123456789";

function tick(authorization?: string) {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return POST(new Request("http://localhost:4101/api/jobs/tick", { method: "POST", headers }));
}

async function clean() {
  await db.weeklyResult.deleteMany();
  await db.weekSettlement.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.swim.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.user.deleteMany();
}

/** A published tournament whose start-choice deadline has passed, with one team without a start. */
async function dueTournamentWithOpenTeam() {
  const organizer = await db.user.create({
    data: { email: "organizer@example.com", passwordHash: "h", displayName: "organizer" },
  });
  const tournament = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status: "PUBLISHED",
      inviteToken: "token-tick-route",
      name: "Cup",
      description: "d",
      seasonStartAt: new Date(Date.now() + 86_400_000),
      seasonEndAt: new Date(Date.now() + 30 * 86_400_000),
      startChoiceDeadlineAt: new Date(Date.now() - 60_000),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
  return db.team.create({
    data: { tournamentId: tournament.id, name: "Sharks", emblemKey: "dolphin", memberLimit: 5 },
  });
}

const startOf = async (id: string) =>
  (await db.team.findUniqueOrThrow({ where: { id }, select: { startDestination: true } }))
    .startDestination;

describe("POST /api/jobs/tick", () => {
  beforeEach(async () => {
    await clean();
    vi.stubEnv("CRON_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("assigns the starts of due tournaments with the right secret", async () => {
    const team = await dueTournamentWithOpenTeam();

    const res = await tick(`Bearer ${SECRET}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      startAssignments: { tournaments: 1, assigned: 1, failed: 0 },
      weekSettlements: { weeks: 0, failed: 0 },
      seasonEnds: { tournaments: 0, failed: 0 },
      xpWeekSettlements: { players: 0, failed: 0 },
      pushes: { sent: 0, removed: 0, failed: 0 },
    });
    expect(await startOf(team.id)).not.toBeNull();
  });

  it("is idempotent: a repeated tick changes nothing", async () => {
    const team = await dueTournamentWithOpenTeam();
    await tick(`Bearer ${SECRET}`);
    const first = await startOf(team.id);

    const res = await tick(`Bearer ${SECRET}`);

    expect(await res.json()).toEqual({
      startAssignments: { tournaments: 0, assigned: 0, failed: 0 },
      weekSettlements: { weeks: 0, failed: 0 },
      seasonEnds: { tournaments: 0, failed: 0 },
      xpWeekSettlements: { players: 0, failed: 0 },
      pushes: { sent: 0, removed: 0, failed: 0 },
    });
    expect(await startOf(team.id)).toBe(first);
    expect(await db.auditEvent.count()).toBe(1);
  });

  it("settles the weekly multiplier of weeks that have ended", async () => {
    const team = await dueTournamentWithOpenTeam();
    await db.tournament.update({
      where: { id: team.tournamentId },
      data: { seasonStartAt: new Date(Date.now() - 15 * 86_400_000) },
    });

    const res = await tick(`Bearer ${SECRET}`);

    const { weekSettlements } = await res.json();
    expect(weekSettlements.weeks).toBeGreaterThanOrEqual(2);
    expect(weekSettlements.failed).toBe(0);
    expect(await db.weekSettlement.count()).toBe(weekSettlements.weeks);
  });

  it.each([
    ["missing", undefined],
    ["wrong", "Bearer not-the-secret"],
    ["a prefix of the", `Bearer ${SECRET.slice(0, -1)}`],
    ["a longer", `Bearer ${SECRET}x`],
    ["a non-Bearer", `Basic ${SECRET}`],
    ["an empty", "Bearer "],
  ])("refuses %s secret with 401 and changes nothing", async (_label, authorization) => {
    const team = await dueTournamentWithOpenTeam();

    const res = await tick(authorization);

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(await startOf(team.id)).toBeNull();
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])("answers 503 when CRON_SECRET is %s", async (_label, value) => {
    vi.stubEnv("CRON_SECRET", value);
    const team = await dueTournamentWithOpenTeam();

    const res = await tick("Bearer ");

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("SERVICE_UNAVAILABLE");
    expect(await startOf(team.id)).toBeNull();
  });
});
