import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

async function clean() {
  await db.pointsEntry.deleteMany();
  await db.swimResult.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

async function makeOrganizer() {
  return db.user.create({
    data: { email: "organizer@example.com", passwordHash: "hash", displayName: "Organizer" },
  });
}

const releaseOneDefaults = {
  swimTypeAllowed: "ANY",
  submissionDays: 7,
  lateUploadDays: 3,
  firstSwimBonusPoints: 20,
  longSwimTier1M: 1000,
  longSwimTier1Points: 10,
  longSwimTier2M: 3000,
  longSwimTier2Points: 25,
  multiplierTwoDaysPct: 110,
  multiplierThreeDaysPct: 120,
  streakStepPct: 5,
  multiplierMaxPct: 140,
  minSwimDistanceM: null,
  extraSlowestPaceSecPer100m: null,
  swimLimitBounds: null,
  visibility: null,
  inviteEnabled: true,
  bannerImageId: null,
  logoImageId: null,
  rulesUrl: null,
  eligibilityNotes: null,
  contactChannel: null,
  rulesText: null,
  archivedAt: null,
  seasonEndProcessedAt: null,
};

describe("tournament settings schema", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("gives a tournament created without the new fields every release 1 default", async () => {
    const organizer = await makeOrganizer();

    const tournament = await db.tournament.create({
      data: {
        organizerId: organizer.id,
        name: "Summer Swim",
        description: "A season of swimming",
        seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
        seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
        routeId: "route01",
        routeDistanceM: 1650000,
      },
    });

    expect(tournament).toMatchObject(releaseOneDefaults);
  });

  it("fills the defaults at database level for rows inserted without the new columns", async () => {
    const organizer = await makeOrganizer();

    await db.$executeRaw`
      INSERT INTO "Tournament" ("id", "organizerId", "name", "description", "seasonStartAt",
        "seasonEndAt", "routeId", "routeDistanceM", "updatedAt")
      VALUES ('legacy-tournament', ${organizer.id}, 'Legacy', 'Created before the settings',
        '2026-11-01T00:00:00+07:00', '2026-12-01T00:00:00+07:00', 'route01', 1650000, now())`;

    const tournament = await db.tournament.findUniqueOrThrow({
      where: { id: "legacy-tournament" },
    });
    expect(tournament).toMatchObject(releaseOneDefaults);
  });

  it("stores every optional setting when given", async () => {
    const organizer = await makeOrganizer();
    const bounds = { fastestPaceSecPer100m: { min: 50, max: 120 } };

    const tournament = await db.tournament.create({
      data: {
        organizerId: organizer.id,
        name: "Open Water Cup",
        description: "Open water only",
        seasonStartAt: new Date("2026-11-01T00:00:00+07:00"),
        seasonEndAt: new Date("2026-12-01T00:00:00+07:00"),
        routeId: "route01",
        routeDistanceM: 1650000,
        swimTypeAllowed: "OPEN_WATER_ONLY",
        minSwimDistanceM: 500,
        extraSlowestPaceSecPer100m: 240,
        swimLimitBounds: bounds,
        visibility: "PUBLIC",
        inviteEnabled: false,
        bannerImageId: "banner-1",
        logoImageId: "logo-1",
        rulesUrl: "https://example.com/rules",
        eligibilityNotes: "Adults only",
        contactChannel: "Zalo group",
        rulesText: "Swim fair.",
        archivedAt: new Date("2026-12-10T00:00:00Z"),
        seasonEndProcessedAt: new Date("2026-12-01T01:00:00Z"),
      },
    });

    expect(tournament).toMatchObject({
      swimTypeAllowed: "OPEN_WATER_ONLY",
      minSwimDistanceM: 500,
      extraSlowestPaceSecPer100m: 240,
      swimLimitBounds: bounds,
      visibility: "PUBLIC",
      inviteEnabled: false,
      contactChannel: "Zalo group",
    });
    expect(tournament.archivedAt?.toISOString()).toBe("2026-12-10T00:00:00.000Z");
    expect(tournament.seasonEndProcessedAt?.toISOString()).toBe("2026-12-01T01:00:00.000Z");
  });
});
