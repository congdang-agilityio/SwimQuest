import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { updateDetails } from "./update-details";

const SEASON_START = new Date("2026-11-01T06:00:00+07:00");
const SEASON_END = new Date("2026-11-30T23:59:00+07:00");
const BEFORE = new Date("2026-10-20T12:00:00+07:00");
const DURING = new Date("2026-11-15T12:00:00+07:00");
const AFTER = new Date("2026-12-05T12:00:00+07:00");
const NEW_START = { date: "2026-11-03", time: "07:30" };
const NEW_START_AT = new Date("2026-11-03T07:30:00+07:00");
const NEW_END = { date: "2026-12-10", time: "20:00" };
const NEW_END_AT = new Date("2026-12-10T20:00:00+07:00");

type Status = "DRAFT" | "PUBLISHED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

async function clean() {
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
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

const makeUser = (name: string, isPlatformAdmin = false) =>
  db.user.create({
    data: { email: `${name}@example.com`, passwordHash: "h", displayName: name, isPlatformAdmin },
  });

const makeTournament = (organizerId: string, status: Status) =>
  db.tournament.create({
    data: {
      organizerId,
      status,
      name: "Autumn Expedition",
      description: "Swim to Ly Son together",
      seasonStartAt: SEASON_START,
      seasonEndAt: SEASON_END,
      routeId: "route01",
      routeDistanceM: 100_000,
    },
  });

const stored = (id: string) =>
  db.tournament.findUniqueOrThrow({
    where: { id },
    select: {
      name: true,
      description: true,
      seasonStartAt: true,
      seasonEndAt: true,
      startChoiceDeadlineAt: true,
      routeId: true,
      routeDistanceM: true,
    },
  });

const UNCHANGED = {
  name: "Autumn Expedition",
  description: "Swim to Ly Son together",
  seasonStartAt: SEASON_START,
  seasonEndAt: SEASON_END,
  startChoiceDeadlineAt: null,
  routeId: "route01",
  routeDistanceM: 100_000,
};

beforeEach(clean);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("updateDetails: draft and published before the start", () => {
  it("saves name, description, season start and end with the default deadline kept null", async () => {
    const organizer = await makeUser("organizer");
    for (const status of ["DRAFT", "PUBLISHED"] as const) {
      const t = await makeTournament(organizer.id, status);
      const input = {
        name: "  Winter Swim ",
        description: "New text",
        seasonStart: NEW_START,
        seasonEnd: NEW_END,
      };

      const result = await updateDetails(organizer, t.id, input, BEFORE);

      const saved = {
        name: "Winter Swim",
        description: "New text",
        seasonStartAt: NEW_START_AT,
        seasonEndAt: NEW_END_AT,
        startChoiceDeadlineAt: null,
      };
      expect(result).toEqual({ ok: true, tournament: { id: t.id, ...saved } });
      await expect(stored(t.id)).resolves.toEqual({ ...UNCHANGED, ...saved });
    }
  });

  it("saves a draft after its season start date (a draft never becomes active)", async () => {
    const organizer = await makeUser("organizer");
    const t = await makeTournament(organizer.id, "DRAFT");

    const result = await updateDetails(organizer, t.id, { seasonStart: NEW_START }, DURING);

    expect(result.ok).toBe(true);
    expect((await stored(t.id)).seasonStartAt).toEqual(NEW_START_AT);
  });

  it("refuses an end before the start, also against the stored start", async () => {
    const organizer = await makeUser("organizer");
    const t = await makeTournament(organizer.id, "PUBLISHED");
    const early = { date: "2026-10-30", time: "06:00" };
    const inputs = [{ seasonStart: NEW_START, seasonEnd: early }, { seasonEnd: early }];
    const late = { seasonStart: { date: "2026-12-01", time: "06:00" } };

    for (const input of [...inputs, late]) {
      const result = await updateDetails(organizer, t.id, input, BEFORE);
      expect(result).toEqual({
        ok: false,
        reason: "INVALID",
        errors: { seasonEnd: "SEASON_END_NOT_AFTER_START" },
      });
    }
    await expect(stored(t.id)).resolves.toEqual(UNCHANGED);
  });

  it("validates fields like creation and refuses unknown, route or no fields", async () => {
    const organizer = await makeUser("organizer");
    const t = await makeTournament(organizer.id, "DRAFT");
    const cases: [unknown, Record<string, string>][] = [
      [{ name: " " }, { name: "NAME_REQUIRED" }],
      [{ description: "x".repeat(2001) }, { description: "DESCRIPTION_TOO_LONG" }],
      [
        { seasonStart: { date: "2026-13-01", time: "06:00" } },
        { seasonStart: "SEASON_START_INVALID" },
      ],
      [{ name: "Ok", organizerId: "someone" }, { organizerId: "UNKNOWN_FIELD" }],
      [{ routeId: "route02" }, { routeId: "UNKNOWN_FIELD" }],
      [{}, { body: "NO_CHANGE" }],
      [null, { body: "INVALID_BODY" }],
      [["name"], { body: "INVALID_BODY" }],
    ];

    for (const [input, errors] of cases) {
      const result = await updateDetails(organizer, t.id, input, BEFORE);
      expect(result).toEqual({ ok: false, reason: "INVALID", errors });
    }
    await expect(stored(t.id)).resolves.toEqual(UNCHANGED);
  });
});

describe("updateDetails: active", () => {
  it.each([
    ["season start", { seasonStart: NEW_START }],
    ["route", { routeId: "route02" }],
    ["route distance", { routeDistanceKm: "50" }],
    ["season start with a name", { name: "New", seasonStart: NEW_START }],
  ])("refuses the %s with SEASON_LOCKED", async (_label, input) => {
    const organizer = await makeUser("organizer");
    for (const status of ["PUBLISHED", "ACTIVE"] as const) {
      const t = await makeTournament(organizer.id, status);

      const result = await updateDetails(organizer, t.id, input, DURING);

      expect(result).toEqual({ ok: false, reason: "SEASON_LOCKED" });
      await expect(stored(t.id)).resolves.toEqual(UNCHANGED);
    }
  });

  it("keeps name and description editable and lets the season end move later", async () => {
    const organizer = await makeUser("organizer");
    const t = await makeTournament(organizer.id, "PUBLISHED");
    const input = { name: "Renamed", description: "Updated", seasonEnd: NEW_END };

    const result = await updateDetails(organizer, t.id, input, DURING);

    expect(result.ok).toBe(true);
    await expect(stored(t.id)).resolves.toEqual({
      ...UNCHANGED,
      name: "Renamed",
      description: "Updated",
      seasonEndAt: NEW_END_AT,
    });
  });

  it("refuses a season end at or before now", async () => {
    const organizer = await makeUser("organizer");
    const t = await makeTournament(organizer.id, "ACTIVE");
    const ends = [
      { date: "2026-11-10", time: "06:00" },
      { date: "2026-11-15", time: "12:00" },
    ];

    for (const seasonEnd of ends) {
      const result = await updateDetails(organizer, t.id, { seasonEnd }, DURING);
      expect(result).toEqual({
        ok: false,
        reason: "INVALID",
        errors: { seasonEnd: "SEASON_END_NOT_AFTER_NOW" },
      });
    }
    await expect(stored(t.id)).resolves.toEqual(UNCHANGED);
  });

  it("locks the season start once the season has ended (completed) and keeps the name editable", async () => {
    const organizer = await makeUser("organizer");
    const t = await makeTournament(organizer.id, "PUBLISHED");

    const locked = await updateDetails(organizer, t.id, { seasonStart: NEW_START }, AFTER);
    const renamed = await updateDetails(organizer, t.id, { name: "Renamed" }, AFTER);

    expect(locked).toEqual({ ok: false, reason: "SEASON_LOCKED" });
    expect(renamed.ok).toBe(true);
    await expect(stored(t.id)).resolves.toEqual({ ...UNCHANGED, name: "Renamed" });
  });

  it.each([
    ["later than now", { seasonEnd: NEW_END }],
    ["earlier than now", { seasonEnd: { date: "2026-12-01", time: "06:00" } }],
    ["with a name", { name: "Renamed", seasonEnd: NEW_END }],
  ])(
    "refuses a season end %s once completed so the season cannot reopen",
    async (_label, input) => {
      const organizer = await makeUser("organizer");
      for (const status of ["PUBLISHED", "ACTIVE", "COMPLETED"] as const) {
        const t = await makeTournament(organizer.id, status);

        const result = await updateDetails(organizer, t.id, input, AFTER);

        expect(result).toEqual({ ok: false, reason: "SEASON_ENDED" });
        await expect(stored(t.id)).resolves.toEqual(UNCHANGED);
      }
    },
  );
});

describe("updateDetails: archived", () => {
  it("refuses every edit with ARCHIVED", async () => {
    const organizer = await makeUser("organizer");
    const t = await makeTournament(organizer.id, "ARCHIVED");

    for (const input of [{ name: "New" }, { description: "New" }, { seasonEnd: NEW_END }]) {
      const result = await updateDetails(organizer, t.id, input, AFTER);
      expect(result).toEqual({ ok: false, reason: "ARCHIVED" });
    }
    await expect(stored(t.id)).resolves.toEqual(UNCHANGED);
  });
});

describe("updateDetails: who may edit", () => {
  it("lets a platform admin edit another organizer's tournament", async () => {
    const organizer = await makeUser("organizer");
    const admin = await makeUser("admin", true);
    const t = await makeTournament(organizer.id, "PUBLISHED");

    const result = await updateDetails(admin, t.id, { name: "By admin" }, BEFORE);

    expect(result.ok).toBe(true);
    expect((await stored(t.id)).name).toBe("By admin");
  });

  it("refuses another player and an unknown tournament without saving", async () => {
    const organizer = await makeUser("organizer");
    const player = await makeUser("player");
    const t = await makeTournament(organizer.id, "PUBLISHED");

    await expect(updateDetails(player, t.id, { name: "Mine" }, BEFORE)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      updateDetails(organizer, "missing", { name: "Mine" }, BEFORE),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(stored(t.id)).resolves.toEqual(UNCHANGED);
  });
});

describe("updateDetails: concurrent change", () => {
  it("returns CONFLICT and saves nothing when the status or dates changed after the read", async () => {
    const organizer = await makeUser("organizer");
    const t = await makeTournament(organizer.id, "PUBLISHED");
    // The read sees the tournament as a draft; it was published before the write.
    vi.spyOn(db.tournament, "findUnique").mockResolvedValueOnce({ ...t, status: "DRAFT" });

    const result = await updateDetails(organizer, t.id, { seasonStart: NEW_START }, DURING);

    expect(result).toEqual({ ok: false, reason: "CONFLICT" });
    await expect(stored(t.id)).resolves.toEqual(UNCHANGED);
  });
});
