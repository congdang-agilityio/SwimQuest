import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError } from "@/server/auth/roles";
import { STARTING_SWIM_LIMIT_CONFIG, type SwimLimitConfig } from "@/lib/swim-limits";
import { getSetting, setSetting } from "./settings";
import {
  getSwimLimitConfig,
  setSwimLimitConfig,
  SWIM_LIMITS_SETTING_KEY,
  SwimLimitConfigError,
} from "./swim-limits-config";

async function clean() {
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.platformSetting.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

let n = 0;
const user = (isPlatformAdmin: boolean, status: "ACTIVE" | "SUSPENDED" = "ACTIVE") =>
  db.user.create({
    data: {
      email: `u${++n}@example.com`,
      passwordHash: "h",
      displayName: `User ${n}`,
      isPlatformAdmin,
      status,
    },
  });
const actor = (u: { id: string; isPlatformAdmin: boolean }) => ({
  id: u.id,
  isPlatformAdmin: u.isPlatformAdmin,
});

const next = (): SwimLimitConfig => ({
  defaults: {
    fastestPaceSecPer100m: 70,
    slowestPaceSecPer100m: 280,
    longestRealisticSwimM: 25_000,
  },
  bounds: {
    fastestPaceSecPer100m: { min: 50, max: 110 },
    slowestPaceSecPer100m: { min: 200, max: 500 },
    longestRealisticSwimM: { min: 10_000, max: 40_000 },
  },
});

describe("platform settings", () => {
  it("returns the fallback without a row, and the stored value after setSetting", async () => {
    const a = await user(true);
    expect(await getSetting("someKey", { x: 1 })).toEqual({ x: 1 });

    await db.$transaction((tx) => setSetting(tx, "someKey", { x: 2 }, a.id));
    await db.$transaction((tx) => setSetting(tx, "someKey", { x: 3 }, a.id));

    expect(await getSetting("someKey", { x: 1 })).toEqual({ x: 3 });
    const row = await db.platformSetting.findUniqueOrThrow({ where: { key: "someKey" } });
    expect(row.updatedById).toBe(a.id);
  });
});

describe("getSwimLimitConfig", () => {
  it("returns the starting defaults and bounds when nothing is stored", async () => {
    expect(await getSwimLimitConfig()).toEqual(STARTING_SWIM_LIMIT_CONFIG);
  });

  it("falls back to the starting config when the stored value is not a valid config", async () => {
    await db.platformSetting.create({ data: { key: SWIM_LIMITS_SETTING_KEY, value: { x: 1 } } });
    expect(await getSwimLimitConfig()).toEqual(STARTING_SWIM_LIMIT_CONFIG);
  });
});

describe("setSwimLimitConfig", () => {
  it("stores the config and records SWIM_LIMITS_CHANGED with old and new values and reason", async () => {
    const a = await user(true);

    const saved = await setSwimLimitConfig(actor(a), next(), "  Season 2 tuning  ");

    expect(saved).toEqual(next());
    expect(await getSwimLimitConfig()).toEqual(next());
    const events = await db.auditEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorType: "USER",
      actorUserId: a.id,
      action: "SWIM_LIMITS_CHANGED",
      entityType: "PlatformSetting",
      entityId: SWIM_LIMITS_SETTING_KEY,
      before: STARTING_SWIM_LIMIT_CONFIG,
      after: next(),
      reason: "Season 2 tuning",
    });
    expect(events[0].createdAt).toBeInstanceOf(Date);
  });

  it("records the previously stored config as the old value on a second change", async () => {
    const a = await user(true);
    await setSwimLimitConfig(actor(a), next(), "first");
    const third = next();
    third.defaults.longestRealisticSwimM = 35_000;

    await setSwimLimitConfig(actor(a), third, "second");

    const last = await db.auditEvent.findFirstOrThrow({ where: { reason: "second" } });
    expect(last.before).toEqual(next());
    expect(last.after).toEqual(third);
    expect(await getSwimLimitConfig()).toEqual(third);
  });

  const invalidCases: [string, (c: SwimLimitConfig) => void, Record<string, string>][] = [
    [
      "a default outside its bounds",
      (c) => (c.defaults.longestRealisticSwimM = 50_000),
      { "defaults.longestRealisticSwimM": "OUT_OF_BOUNDS" },
    ],
    [
      "a lowest bound above the highest",
      (c) => (c.bounds.fastestPaceSecPer100m = { min: 120, max: 60 }),
      { "bounds.fastestPaceSecPer100m": "MIN_ABOVE_MAX" },
    ],
    [
      "a default fastest pace not faster than the default slowest",
      (c) => {
        c.bounds.fastestPaceSecPer100m = { min: 50, max: 300 };
        c.defaults.fastestPaceSecPer100m = 280;
      },
      { "defaults.fastestPaceSecPer100m": "NOT_FASTER_THAN_SLOWEST" },
    ],
  ];

  for (const [name, change, errors] of invalidCases) {
    it(`refuses ${name} with INVALID_LIMIT_CONFIG and saves nothing`, async () => {
      const a = await user(true);
      const c = next();
      change(c);

      const err = await setSwimLimitConfig(actor(a), c, "reason").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(SwimLimitConfigError);
      expect(err).toMatchObject({ status: 400, code: "INVALID_LIMIT_CONFIG", fieldErrors: errors });
      expect(await db.platformSetting.count()).toBe(0);
      expect(await db.auditEvent.count()).toBe(0);
    });
  }

  it("requires a reason and saves nothing without one", async () => {
    const a = await user(true);
    for (const reason of ["", "   ", undefined, 5, "x".repeat(501)]) {
      const err = await setSwimLimitConfig(actor(a), next(), reason as string).catch(
        (e: unknown) => e,
      );
      expect(err).toMatchObject({
        code: "INVALID_LIMIT_CONFIG",
        fieldErrors: { reason: "REQUIRED" },
      });
    }
    expect(await db.platformSetting.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("refuses a non-admin, a suspended admin and a caller claiming the role", async () => {
    const player = await user(false);
    const suspended = await user(true, "SUSPENDED");
    const callers = [
      actor(player),
      { id: player.id, isPlatformAdmin: true },
      actor(suspended),
      { id: "unknown", isPlatformAdmin: true },
    ];
    for (const caller of callers) {
      await expect(setSwimLimitConfig(caller, next(), "reason")).rejects.toThrow(ForbiddenError);
    }
    expect(await db.platformSetting.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });
});
