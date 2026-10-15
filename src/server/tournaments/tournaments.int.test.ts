import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createDraft } from "./create";
import { getTournamentForViewer } from "./get";

const input = {
  name: "Autumn Expedition",
  description: "Swim to Ly Son together",
  seasonStart: { date: "2026-11-01", time: "00:00" },
  seasonEnd: { date: "2026-11-30", time: "23:59" },
  routeId: "route01",
  routeDistanceKm: "123.45",
};

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: email } });
}

async function clean() {
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

describe("tournament drafts", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("creates a draft with the creator as organizer and the default settings", async () => {
    const user = await makeUser("organizer@example.com");

    const result = await createDraft(user.id, input);

    expect(result.ok).toBe(true);
    const id = result.ok ? result.id : "";
    const stored = await db.tournament.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({
      organizerId: user.id,
      status: "DRAFT",
      name: "Autumn Expedition",
      description: "Swim to Ly Son together",
      routeId: "route01",
      routeDistanceM: 123450,
      fastestPaceSecPer100m: 65,
      slowestPaceSecPer100m: 300,
      longestRealisticSwimM: 30000,
      longestSwimCountedM: 10000,
      dailyLimitM: 10000,
      pointsPerKm: 10,
      startChoiceDeadlineAt: null,
      inviteToken: null,
      publishedAt: null,
    });
    expect(stored.seasonStartAt.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(stored.seasonEndAt.toISOString()).toBe("2026-11-30T16:59:00.000Z");
  });

  it("returns field errors and stores nothing for invalid input", async () => {
    const user = await makeUser("organizer@example.com");

    const result = await createDraft(user.id, {
      ...input,
      seasonStart: { date: "2026-11-01", time: "07:00" },
      seasonEnd: { date: "2026-11-01", time: "06:00" },
    });

    expect(result).toEqual({ ok: false, errors: { seasonEnd: "SEASON_END_NOT_AFTER_START" } });
    await expect(db.tournament.count()).resolves.toBe(0);
  });

  it("ignores an organizer or status sent in the input", async () => {
    const user = await makeUser("organizer@example.com");
    const other = await makeUser("other@example.com");

    const result = await createDraft(user.id, {
      ...input,
      organizerId: other.id,
      status: "PUBLISHED",
    });

    const id = result.ok ? result.id : "";
    await expect(db.tournament.findUnique({ where: { id } })).resolves.toMatchObject({
      organizerId: user.id,
      status: "DRAFT",
    });
  });

  it("shows a draft to its organizer", async () => {
    const user = await makeUser("organizer@example.com");
    const created = await createDraft(user.id, input);
    const id = created.ok ? created.id : "";

    const tournament = await getTournamentForViewer(user.id, id);

    expect(tournament).toMatchObject({ id, organizerId: user.id, status: "DRAFT" });
  });

  it("hides a draft from another player and from signed-out viewers like a missing one", async () => {
    const user = await makeUser("organizer@example.com");
    const other = await makeUser("other@example.com");
    const created = await createDraft(user.id, input);
    const id = created.ok ? created.id : "";

    await expect(getTournamentForViewer(other.id, id)).resolves.toBeNull();
    await expect(getTournamentForViewer(null, id)).resolves.toBeNull();
    await expect(getTournamentForViewer(other.id, "missing-id")).resolves.toBeNull();
  });

  it("shows a published tournament to another player", async () => {
    const user = await makeUser("organizer@example.com");
    const other = await makeUser("other@example.com");
    const created = await createDraft(user.id, input);
    const id = created.ok ? created.id : "";
    await db.tournament.update({ where: { id }, data: { status: "PUBLISHED" } });

    await expect(getTournamentForViewer(other.id, id)).resolves.toMatchObject({ id });
  });
});
