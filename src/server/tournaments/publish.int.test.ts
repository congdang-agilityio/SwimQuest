import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { db } from "@/server/db";
import { publishTournament } from "./publish";

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

async function draft(organizerId: string, { withTeam = true, routeDistanceM = 100_000 } = {}) {
  const tournament = await db.tournament.create({
    data: {
      organizerId,
      name: "Cup",
      description: "d",
      seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
      seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM,
    },
  });
  if (withTeam) {
    await db.team.create({
      data: { tournamentId: tournament.id, name: "Sharks", emblemKey: "dolphin", memberLimit: 3 },
    });
  }
  return tournament;
}

async function setup(options: { withTeam?: boolean; routeDistanceM?: number } = {}) {
  const organizer = await user("organizer");
  const outsider = await user("outsider");
  const tournament = await draft(organizer.id, options);
  return { organizer, outsider, tournament };
}

const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url without padding

describe("publishTournament", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("publishes a valid draft once with a URL-safe 32-byte invite token", async () => {
    const { organizer, tournament } = await setup();
    const result = await publishTournament(organizer.id, tournament.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tournament.status).toBe("PUBLISHED");
    expect(result.tournament.inviteToken).toMatch(TOKEN);
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    expect(stored.status).toBe("PUBLISHED");
    expect(stored.publishedAt).toBeInstanceOf(Date);
    expect(stored.inviteToken).toBe(result.tournament.inviteToken);
    expect(result.tournament.publishedAt).toEqual(stored.publishedAt);
  });

  it("returns the same token and changes nothing when published twice in a row", async () => {
    const { organizer, tournament } = await setup();
    const first = await publishTournament(organizer.id, tournament.id);
    const before = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    const second = await publishTournament(organizer.id, tournament.id);
    const after = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id } });

    expect(second).toEqual(first);
    expect(after).toEqual(before);
  });

  it("publishes once when two requests arrive at the same time", async () => {
    const { organizer, tournament } = await setup();
    const results = await Promise.all([
      publishTournament(organizer.id, tournament.id),
      publishTournament(organizer.id, tournament.id),
    ]);

    const tokens = results.map((r) => (r.ok ? r.tournament.inviteToken : null));
    expect(tokens[0]).toMatch(TOKEN);
    expect(tokens[1]).toBe(tokens[0]);
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    expect(stored.inviteToken).toBe(tokens[0]);
  });

  it("refuses an invalid draft with PUBLISH_INVALID and the issues, and changes nothing", async () => {
    const { organizer, tournament } = await setup({ withTeam: false, routeDistanceM: 0 });
    const result = await publishTournament(organizer.id, tournament.id);

    expect(result).toEqual({
      ok: false,
      reason: "PUBLISH_INVALID",
      issues: [
        { code: "ROUTE_DISTANCE_INVALID", field: "routeDistanceKm" },
        { code: "NO_TEAM", field: "teams" },
      ],
    });
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    expect(stored.status).toBe("DRAFT");
    expect(stored.inviteToken).toBeNull();
    expect(stored.publishedAt).toBeNull();
  });

  it("refuses a non-organizer and leaves the draft unpublished", async () => {
    const { outsider, tournament } = await setup();
    await expect(publishTournament(outsider.id, tournament.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    expect(stored.status).toBe("DRAFT");
    expect(stored.inviteToken).toBeNull();
  });

  it("refuses a missing tournament with NotFoundError", async () => {
    const { organizer } = await setup();
    await expect(publishTournament(organizer.id, "missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a non-draft tournament without an invite token with a typed NOT_DRAFT 409", async () => {
    const { organizer, tournament } = await setup();
    await db.tournament.update({
      where: { id: tournament.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    await expect(publishTournament(organizer.id, tournament.id)).rejects.toEqual(
      expect.objectContaining({ code: "NOT_DRAFT", status: 409 }),
    );
    const stored = await db.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
    expect(stored.inviteToken).toBeNull();
  });

  it("gives each tournament its own token", async () => {
    const { organizer, tournament } = await setup();
    const other = await draft(organizer.id);
    const a = await publishTournament(organizer.id, tournament.id);
    const b = await publishTournament(organizer.id, other.id);
    expect(a.ok && b.ok && a.tournament.inviteToken !== b.tournament.inviteToken).toBe(true);
  });
});
