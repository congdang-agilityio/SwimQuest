import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { updateSettings } from "./update-settings";

const NOW = new Date("2099-10-01T00:00:00+07:00");

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

async function make(organizerId: string, name: string, status: "DRAFT" | "ACTIVE") {
  return db.tournament.create({
    data: {
      organizerId,
      status,
      inviteToken: `token-${name}`,
      name,
      description: "d",
      seasonStartAt:
        status === "ACTIVE"
          ? new Date("2099-09-01T06:00:00+07:00")
          : new Date("2099-11-01T06:00:00+07:00"),
      seasonEndAt: new Date("2099-12-01T00:00:00+07:00"),
      routeId: "route01",
      routeDistanceM: 100000,
    },
  });
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("updateSettings extraRules", () => {
  it("saves on this tournament only and refuses a pace that is not stricter", async () => {
    const organizer = await db.user.create({
      data: { email: "o@example.com", passwordHash: "h", displayName: "o" },
    });
    const a = await make(organizer.id, "a", "DRAFT");
    const b = await make(organizer.id, "b", "DRAFT");
    const bad = await updateSettings(
      organizer.id,
      a.id,
      "extraRules",
      { extraSlowestPace: "5:00" },
      NOW,
    );
    expect(bad).toMatchObject({ ok: false, reason: "INVALID" });
    const ok = await updateSettings(
      organizer.id,
      a.id,
      "extraRules",
      { minSwimDistanceM: "400", extraSlowestPace: "4:30" },
      NOW,
    );
    expect(ok).toEqual({
      ok: true,
      group: "extraRules",
      values: { minSwimDistanceM: 400, extraSlowestPaceSecPer100m: 270 },
    });
    expect(await db.tournament.findUnique({ where: { id: a.id } })).toMatchObject({
      minSwimDistanceM: 400,
      extraSlowestPaceSecPer100m: 270,
    });
    expect(await db.tournament.findUnique({ where: { id: b.id } })).toMatchObject({
      minSwimDistanceM: null,
      extraSlowestPaceSecPer100m: null,
    });
  });

  it("is refused once the tournament is active", async () => {
    const organizer = await db.user.create({
      data: { email: "o@example.com", passwordHash: "h", displayName: "o" },
    });
    const t = await make(organizer.id, "act", "ACTIVE");
    const result = await updateSettings(
      organizer.id,
      t.id,
      "extraRules",
      { minSwimDistanceM: 400 },
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "SEASON_LOCKED" });
    expect((await db.tournament.findUnique({ where: { id: t.id } }))?.minSwimDistanceM).toBeNull();
  });
});
