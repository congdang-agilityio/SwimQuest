import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { awardDistancePoints } from "@/server/scoring/award-distance-points";
import { getSettings, updateSettings } from "./update-settings";

const SEASON_START = new Date("2026-11-01T06:00:00+07:00");
const SEASON_END = new Date("2026-11-30T23:59:00+07:00");
const BEFORE = new Date("2026-11-01T05:59:59.999+07:00");
const DURING = new Date("2026-11-15T12:00:00+07:00");
const AFTER = new Date("2026-12-05T12:00:00+07:00");
const INPUT = { longestSwimCountedKm: "5", dailyLimitKm: "12.5", swimTypeAllowed: "POOL_ONLY" };
const SAVED = { longestSwimCountedM: 5_000, dailyLimitM: 12_500, swimTypeAllowed: "POOL_ONLY" };
const DEADLINE_DEFAULTS = { submissionDays: 7, lateUploadDays: 3, startChoiceDeadlineAt: null };
const DEFAULTS = { longestSwimCountedM: 10_000, dailyLimitM: 10_000, swimTypeAllowed: "ANY" };

async function clean() {
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

const makeUser = (email: string) =>
  db.user.create({ data: { email, passwordHash: "hash", displayName: email } });

/** A tournament with the schema defaults for every setting. */
const makeTournament = (organizerId: string, status: "DRAFT" | "PUBLISHED" | "COMPLETED") =>
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
    select: { longestSwimCountedM: true, dailyLimitM: true, swimTypeAllowed: true },
  });

beforeEach(clean);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("updateSettings", () => {
  it("saves the swim group of a draft and of a published tournament in metres", async () => {
    const user = await makeUser("organizer@example.com");
    for (const status of ["DRAFT", "PUBLISHED"] as const) {
      const t = await makeTournament(user.id, status);

      const result = await updateSettings(user.id, t.id, "swim", INPUT, BEFORE);

      expect(result).toEqual({ ok: true, group: "swim", values: SAVED });
      await expect(stored(t.id)).resolves.toEqual(SAVED);
    }
  });

  it("saves a draft even after its season start date (a draft never becomes active)", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id, "DRAFT");

    const result = await updateSettings(user.id, t.id, "swim", INPUT, DURING);

    expect(result.ok).toBe(true);
    await expect(stored(t.id)).resolves.toEqual(SAVED);
  });

  it("refuses with SEASON_LOCKED once the tournament is active or later", async () => {
    const user = await makeUser("organizer@example.com");
    const published = await makeTournament(user.id, "PUBLISHED");
    const completed = await makeTournament(user.id, "COMPLETED");

    for (const [id, now] of [
      [published.id, SEASON_START],
      [published.id, DURING],
      [published.id, AFTER],
      [completed.id, BEFORE],
    ] as const) {
      const result = await updateSettings(user.id, id, "swim", INPUT, now);
      expect(result).toEqual({ ok: false, reason: "SEASON_LOCKED" });
      await expect(stored(id)).resolves.toEqual(DEFAULTS);
    }
  });

  it("refuses with SEASON_LOCKED when the season start moved after it was read", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id, "PUBLISHED");
    // The guard reads the old season start; the stored one moved to `now` in between.
    vi.spyOn(db.tournament, "findUnique").mockResolvedValueOnce(t as never);
    await db.tournament.update({ where: { id: t.id }, data: { seasonStartAt: BEFORE } });

    const result = await updateSettings(user.id, t.id, "swim", INPUT, BEFORE);

    expect(result).toEqual({ ok: false, reason: "SEASON_LOCKED" });
    await expect(stored(t.id)).resolves.toEqual(DEFAULTS);
  });

  it("refuses a non-organizer and a missing tournament", async () => {
    const organizer = await makeUser("organizer@example.com");
    const other = await makeUser("other@example.com");
    const t = await makeTournament(organizer.id, "DRAFT");

    await expect(updateSettings(other.id, t.id, "swim", INPUT, BEFORE)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(updateSettings(organizer.id, "missing", "swim", INPUT, BEFORE)).rejects.toThrow(
      NotFoundError,
    );
    await expect(stored(t.id)).resolves.toEqual(DEFAULTS);
  });

  it("refuses an unknown group and invalid input, changing nothing", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id, "DRAFT");

    expect(await updateSettings(user.id, t.id, "nope", INPUT, BEFORE)).toEqual({
      ok: false,
      reason: "UNKNOWN_GROUP",
    });
    expect(await updateSettings(user.id, t.id, "toString", INPUT, BEFORE)).toEqual({
      ok: false,
      reason: "UNKNOWN_GROUP",
    });
    const cases: [unknown, Record<string, string>][] = [
      [{ ...INPUT, longestSwimCountedKm: 0 }, { longestSwimCountedKm: "DISTANCE_NOT_POSITIVE" }],
      [{ ...INPUT, dailyLimitKm: "-2" }, { dailyLimitKm: "DISTANCE_NOT_POSITIVE" }],
      [{ ...INPUT, swimTypeAllowed: "LAKE" }, { swimTypeAllowed: "SWIM_TYPE_INVALID" }],
      [{ ...INPUT, pointsPerKm: 5 }, { pointsPerKm: "UNKNOWN_FIELD" }],
      [null, { body: "INVALID_BODY" }],
      [["5"], { body: "INVALID_BODY" }],
    ];
    for (const [input, errors] of cases) {
      const result = await updateSettings(user.id, t.id, "swim", input, BEFORE);
      expect(result).toEqual({ ok: false, reason: "INVALID", errors });
    }
    await expect(stored(t.id)).resolves.toEqual(DEFAULTS);
  });

  it("makes awardDistancePoints use the saved values (longest swim 5 km caps a 6 km swim)", async () => {
    const organizer = await makeUser("organizer@example.com");
    const player = await makeUser("player@example.com");
    const t = await makeTournament(organizer.id, "PUBLISHED");
    await updateSettings(organizer.id, t.id, "swim", INPUT, BEFORE);

    const team = await db.team.create({
      data: { tournamentId: t.id, name: "Dolphins", emblemKey: "dolphin", memberLimit: 5 },
    });
    await db.teamMember.create({
      data: { tournamentId: t.id, teamId: team.id, userId: player.id },
    });
    const startedAt = new Date("2026-11-10T06:00:00+07:00");
    const swim = await db.swim.create({
      data: {
        userId: player.id,
        source: "FIT",
        fileSha256: "a".repeat(64),
        originalFilename: "swim.fit",
        startedAt,
        endedAt: new Date(startedAt.getTime() + 3600_000),
        distanceM: 6_000,
        durationS: 3600,
        swimType: "POOL",
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
        status: "VERIFIED",
        reasons: [],
      },
    });

    await db.$transaction((tx) => awardDistancePoints(tx, result));

    const entry = await db.pointsEntry.findFirstOrThrow({ where: { swimResultId: result.id } });
    expect(entry).toMatchObject({ countedM: 5_000, points: 50 });
  });
});

describe("updateSettings visibility", () => {
  it("is not season-locked: changes while active or completed, existing members stay", async () => {
    const user = await makeUser("organizer@example.com");
    const member = await makeUser("member@example.com");
    const t = await makeTournament(user.id, "PUBLISHED");
    const team = await db.team.create({
      data: { tournamentId: t.id, name: "Sharks", emblemKey: "dolphin", memberLimit: 3 },
    });
    await db.teamMember.create({
      data: { teamId: team.id, tournamentId: t.id, userId: member.id },
    });

    for (const [id, now, value] of [
      [t.id, DURING, "PUBLIC"],
      [t.id, AFTER, "INVITE_ONLY"],
    ] as const) {
      const result = await updateSettings(user.id, id, "visibility", { visibility: value }, now);
      expect(result).toEqual({ ok: true, group: "visibility", values: { visibility: value } });
    }
    const completed = await makeTournament(user.id, "COMPLETED");
    await expect(
      updateSettings(user.id, completed.id, "visibility", { visibility: "PUBLIC" }, AFTER),
    ).resolves.toMatchObject({ ok: true });

    await expect(db.teamMember.count({ where: { teamId: team.id } })).resolves.toBe(1);
  });

  it("rejects an invalid value and keeps the stored one", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id, "DRAFT");
    const result = await updateSettings(user.id, t.id, "visibility", { visibility: "x" }, BEFORE);
    expect(result).toEqual({
      ok: false,
      reason: "INVALID",
      errors: { visibility: "VISIBILITY_INVALID" },
    });
    const row = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(row.visibility).toBeNull();
  });
});

describe("getSettings", () => {
  it("returns every group with the schema defaults, then the saved values", async () => {
    const user = await makeUser("organizer@example.com");
    const t = await makeTournament(user.id, "DRAFT");

    await expect(getSettings(t.id)).resolves.toEqual({
      swim: DEFAULTS,
      deadlines: DEADLINE_DEFAULTS,
      visibility: { visibility: null },
    });
    await updateSettings(user.id, t.id, "swim", INPUT, BEFORE);
    await expect(getSettings(t.id)).resolves.toEqual({
      swim: SAVED,
      deadlines: DEADLINE_DEFAULTS,
      visibility: { visibility: null },
    });
  });

  it("returns null for a missing tournament", async () => {
    await expect(getSettings("missing")).resolves.toBeNull();
    await expect(getSettings("")).resolves.toBeNull();
  });
});
