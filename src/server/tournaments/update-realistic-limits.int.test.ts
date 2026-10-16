import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateSwim } from "@/server/checks/standard-checks";
import { db } from "@/server/db";
import { updateSettings } from "./update-settings";

const NOW = new Date("2099-10-01T00:00:00+07:00");
const LIMITS = { fastestPace: "1:05", slowestPace: "4:00", longestRealisticSwimKm: "30" };

async function clean() {
  await db.domainEvent.deleteMany();
  await db.teamMember.deleteMany();
  await db.team.deleteMany();
  await db.tournament.deleteMany();
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

async function setup(status: "DRAFT" | "ACTIVE", extra: Record<string, unknown> = {}) {
  const organizer = await db.user.create({
    data: { email: "o@example.com", passwordHash: "h", displayName: "o" },
  });
  const t = await db.tournament.create({
    data: {
      organizerId: organizer.id,
      status,
      inviteToken: `token-${status}`,
      name: status,
      description: "d",
      seasonStartAt:
        status === "ACTIVE"
          ? new Date("2099-09-01T06:00:00+07:00")
          : new Date("2099-11-01T06:00:00+07:00"),
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
      ...extra,
    },
  });
  return { organizer, t };
}

beforeEach(clean);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("updateSettings realisticLimits", () => {
  it("saves values the standard checks then use: a 4:30 swim is flagged at slowest 4:00", async () => {
    const { organizer, t } = await setup("DRAFT");
    const swim = {
      isSwim: true,
      startedAt: new Date("2099-11-10T06:00:00+07:00"),
      distanceM: 1000,
      durationS: 2700,
    };
    const before = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(evaluateSwim(swim, before).status).toBe("VERIFIED");

    const result = await updateSettings(organizer.id, t.id, "realisticLimits", LIMITS, NOW);
    expect(result).toEqual({
      ok: true,
      group: "realisticLimits",
      values: {
        fastestPaceSecPer100m: 65,
        slowestPaceSecPer100m: 240,
        longestRealisticSwimM: 30000,
      },
    });
    const after = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(evaluateSwim(swim, after)).toEqual({ status: "FLAGGED", reasons: ["PACE_TOO_SLOW"] });
  });

  it("refuses values outside the tournament's bounds snapshot with the range; nothing saved", async () => {
    const { organizer, t } = await setup("DRAFT", {
      swimLimitBounds: { slowestPaceSecPer100m: { min: 250, max: 400 } },
    });
    const result = await updateSettings(organizer.id, t.id, "realisticLimits", LIMITS, NOW);
    expect(result).toEqual({
      ok: false,
      reason: "INVALID",
      errors: { slowestPace: "LIMIT_OUT_OF_BOUNDS", slowestPaceRange: "4:10-6:40" },
    });
    expect(
      (await db.tournament.findUniqueOrThrow({ where: { id: t.id } })).slowestPaceSecPer100m,
    ).toBe(300);
  });

  it("refuses a slowest pace the stored extra slowest pace would no longer beat", async () => {
    const { organizer, t } = await setup("DRAFT", { extraSlowestPaceSecPer100m: 240 });
    const result = await updateSettings(organizer.id, t.id, "realisticLimits", LIMITS, NOW);
    expect(result).toMatchObject({
      ok: false,
      reason: "INVALID",
      errors: { slowestPace: "EXTRA_PACE_NOT_STRICTER", extraSlowestPace: "4:00" },
    });
  });

  it("refuses a longest swim the stored extra minimum distance would no longer stay below", async () => {
    const { organizer, t } = await setup("DRAFT", { minSwimDistanceM: 10_000 });
    const input = { ...LIMITS, longestRealisticSwimKm: "10" };
    const result = await updateSettings(organizer.id, t.id, "realisticLimits", input, NOW);
    expect(result).toEqual({
      ok: false,
      reason: "INVALID",
      errors: { longestRealisticSwimKm: "EXTRA_DISTANCE_NOT_STRICTER", minSwimDistance: "10" },
    });
  });

  it("re-checks on the fresh row when the extra rules changed after the read; nothing saved", async () => {
    const { organizer, t } = await setup("DRAFT");
    const stale = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    await db.tournament.update({ where: { id: t.id }, data: { extraSlowestPaceSecPer100m: 250 } });
    vi.spyOn(db.tournament, "findUnique").mockResolvedValueOnce(stale);
    const result = await updateSettings(organizer.id, t.id, "realisticLimits", LIMITS, NOW);
    expect(result).toEqual({
      ok: false,
      reason: "INVALID",
      errors: { slowestPace: "EXTRA_PACE_NOT_STRICTER", extraSlowestPace: "4:10" },
    });
    const row = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    expect(row.slowestPaceSecPer100m).toBe(300);
  });

  it("extra rules re-check on the fresh row when the realistic limits changed after the read", async () => {
    const { organizer, t } = await setup("DRAFT");
    const stale = await db.tournament.findUniqueOrThrow({ where: { id: t.id } });
    await db.tournament.update({ where: { id: t.id }, data: { longestRealisticSwimM: 8000 } });
    vi.spyOn(db.tournament, "findUnique").mockResolvedValueOnce(stale);
    const input = { minSwimDistanceM: "9000", extraSlowestPace: "" };
    const result = await updateSettings(organizer.id, t.id, "extraRules", input, NOW);
    expect(result).toEqual({
      ok: false,
      reason: "INVALID",
      errors: { minSwimDistanceM: "EXTRA_DISTANCE_TOO_LARGE" },
    });
    expect((await db.tournament.findUniqueOrThrow({ where: { id: t.id } })).minSwimDistanceM).toBe(
      null,
    );
  });

  it("is refused once the tournament is active", async () => {
    const { organizer, t } = await setup("ACTIVE");
    const result = await updateSettings(organizer.id, t.id, "realisticLimits", LIMITS, NOW);
    expect(result).toEqual({ ok: false, reason: "SEASON_LOCKED" });
    expect(
      (await db.tournament.findUniqueOrThrow({ where: { id: t.id } })).slowestPaceSecPer100m,
    ).toBe(300);
  });
});
