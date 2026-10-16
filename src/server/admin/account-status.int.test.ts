import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import {
  CannotSuspendSelfError,
  InvalidAccountStateError,
  ReasonRequiredError,
  reactivateUser,
  suspendUser,
} from "./account-status";

async function clean() {
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

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

const user = (name: string, isPlatformAdmin = false) =>
  db.user.create({
    data: {
      email: `${name.toLowerCase()}@example.com`,
      passwordHash: "h",
      displayName: name,
      isPlatformAdmin,
    },
  });
const actor = (u: { id: string; isPlatformAdmin: boolean }) => ({
  id: u.id,
  isPlatformAdmin: u.isPlatformAdmin,
});
const session = (userId: string, tokenHash: string) =>
  db.session.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + 3_600_000) } });

/** A swimmer on a team with one verified swim, its points entry and its XP entry. */
async function swimmerWithPoints() {
  const organizer = await user("Organizer");
  const swimmer = await user("Swimmer");
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
  const team = await db.team.create({
    data: { tournamentId: tournament.id, name: "Dolphins", emblemKey: "dolphin", memberLimit: 5 },
  });
  await db.teamMember.create({
    data: { teamId: team.id, tournamentId: tournament.id, userId: swimmer.id },
  });
  const swim = await db.swim.create({
    data: {
      userId: swimmer.id,
      source: "GPX",
      fileSha256: "a".repeat(64),
      originalFilename: "morning.gpx",
      startedAt: new Date("2026-11-02T06:00:00+07:00"),
      endedAt: new Date("2026-11-02T06:50:00+07:00"),
      distanceM: 2450,
      durationS: 3000,
      swimType: "OPEN_WATER",
      sport: "swimming",
      isSwim: true,
    },
  });
  const result = await db.swimResult.create({
    data: {
      swimId: swim.id,
      tournamentId: tournament.id,
      teamId: team.id,
      userId: swimmer.id,
      status: "VERIFIED",
      reasons: [],
      countedM: 2400,
    },
  });
  await db.pointsEntry.create({
    data: {
      tournamentId: tournament.id,
      userId: swimmer.id,
      teamId: team.id,
      swimResultId: result.id,
      kind: "DISTANCE",
      points: 24,
      countedM: 2400,
      vnDay: "2026-11-02",
    },
  });
  await db.xpEntry.create({
    data: { userId: swimmer.id, swimId: swim.id, kind: "DISTANCE", xp: 24, vnDay: "2026-11-02" },
  });
  return swimmer;
}

const snapshot = async (userId: string) => ({
  swims: await db.swim.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  results: await db.swimResult.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  points: await db.pointsEntry.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  members: await db.teamMember.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  xp: await db.xpEntry.findMany({ where: { userId }, orderBy: { id: "asc" } }),
});

describe("suspendUser", () => {
  it("suspends an active user, ends all their sessions and audits it", async () => {
    const admin = await user("Admin", true);
    const target = await user("Lan");
    await session(target.id, "t1");
    await session(target.id, "t2");
    await session(admin.id, "a1");

    const out = await suspendUser(actor(admin), target.id, "  Spam uploads  ");

    expect(out).toEqual({ id: target.id, status: "SUSPENDED" });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "SUSPENDED",
    );
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await db.session.count({ where: { userId: admin.id } })).toBe(1);
    const events = await db.auditEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorType: "USER",
      actorUserId: admin.id,
      action: "ACCOUNT_SUSPENDED",
      entityType: "User",
      entityId: target.id,
      before: { status: "ACTIVE" },
      after: { status: "SUSPENDED" },
      reason: "Spam uploads",
    });
    expect(events[0].createdAt).toBeInstanceOf(Date);
  });

  it("keeps the user's swims, points entries and team memberships unchanged", async () => {
    const admin = await user("Admin", true);
    const swimmer = await swimmerWithPoints();
    const before = await snapshot(swimmer.id);
    expect(before.points).toHaveLength(1);
    expect(before.members).toHaveLength(1);
    expect(before.xp).toHaveLength(1);

    await suspendUser(actor(admin), swimmer.id, "Cheating report");
    expect(await snapshot(swimmer.id)).toEqual(before);
    await reactivateUser(actor(admin), swimmer.id, "Report was wrong");
    expect(await snapshot(swimmer.id)).toEqual(before);
  });

  it("requires a non-blank reason and changes nothing without one", async () => {
    const admin = await user("Admin", true);
    const target = await user("Lan");
    await session(target.id, "t1");

    for (const reason of ["", "   ", undefined, 42, "x".repeat(501)]) {
      await expect(suspendUser(actor(admin), target.id, reason as string)).rejects.toBeInstanceOf(
        ReasonRequiredError,
      );
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe("ACTIVE");
    expect(await db.session.count()).toBe(1);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("accepts a reason of exactly 500 characters, also with surrounding spaces", async () => {
    const admin = await user("Admin", true);
    const lan = await user("Lan");
    const minh = await user("Minh");
    const reason = "x".repeat(500);

    await expect(suspendUser(actor(admin), lan.id, reason)).resolves.toMatchObject({
      status: "SUSPENDED",
    });
    await expect(suspendUser(actor(admin), minh.id, `  ${reason}  `)).resolves.toMatchObject({
      status: "SUSPENDED",
    });
    const events = await db.auditEvent.findMany();
    expect(events.map((e) => e.reason)).toEqual([reason, reason]);
  });

  it("lets only one of two admins suspending each other at once succeed", async () => {
    for (let round = 0; round < 5; round++) {
      await clean();
      const a = await user("AdminA", true);
      const b = await user("AdminB", true);

      const results = await Promise.allSettled([
        suspendUser(actor(a), b.id, "Mutual"),
        suspendUser(actor(b), a.id, "Mutual"),
      ]);

      const ok = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");
      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(ForbiddenError);
      const active = await db.user.count({ where: { isPlatformAdmin: true, status: "ACTIVE" } });
      expect(active).toBeGreaterThanOrEqual(1);
      expect(await db.auditEvent.count()).toBe(1);
    }
  });

  it("refuses an admin suspending themselves", async () => {
    const admin = await user("Admin", true);

    await expect(suspendUser(actor(admin), admin.id, "Testing")).rejects.toMatchObject({
      code: "CANNOT_SUSPEND_SELF",
    });
    await expect(suspendUser(actor(admin), admin.id, "Testing")).rejects.toBeInstanceOf(
      CannotSuspendSelfError,
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).status).toBe("ACTIVE");
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("refuses a user who is already suspended with INVALID_STATE", async () => {
    const admin = await user("Admin", true);
    const target = await user("Lan");
    await suspendUser(actor(admin), target.id, "First");

    await expect(suspendUser(actor(admin), target.id, "Again")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await db.auditEvent.count()).toBe(1);
  });

  it("returns NotFoundError for an unknown or malformed user id", async () => {
    const admin = await user("Admin", true);

    await expect(suspendUser(actor(admin), "nope", "Reason")).rejects.toBeInstanceOf(NotFoundError);
    await expect(suspendUser(actor(admin), "", "Reason")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses non-admins, suspended admins and a forged admin flag", async () => {
    const plain = await user("Plain");
    const target = await user("Lan");
    const exAdmin = await user("Ex", true);
    await db.user.update({ where: { id: exAdmin.id }, data: { status: "SUSPENDED" } });
    await session(target.id, "t1");

    for (const a of [{ id: plain.id, isPlatformAdmin: true }, actor(exAdmin), { id: "x" }]) {
      await expect(
        suspendUser(a as { id: string; isPlatformAdmin: boolean }, target.id, "Reason"),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe("ACTIVE");
    expect(await db.session.count()).toBe(1);
    expect(await db.auditEvent.count()).toBe(0);
  });
});

describe("reactivateUser", () => {
  it("reactivates a suspended user and audits it", async () => {
    const admin = await user("Admin", true);
    const target = await user("Lan");
    await suspendUser(actor(admin), target.id, "Spam");

    const out = await reactivateUser(actor(admin), target.id, "Appeal accepted");

    expect(out).toEqual({ id: target.id, status: "ACTIVE" });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe("ACTIVE");
    const events = await db.auditEvent.findMany({ where: { action: "ACCOUNT_REACTIVATED" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorType: "USER",
      actorUserId: admin.id,
      entityType: "User",
      entityId: target.id,
      before: { status: "SUSPENDED" },
      after: { status: "ACTIVE" },
      reason: "Appeal accepted",
    });
  });

  it("refuses a user who is not suspended with INVALID_STATE", async () => {
    const admin = await user("Admin", true);
    const target = await user("Lan");
    const deleted = await user("Gone");
    await db.user.update({ where: { id: deleted.id }, data: { status: "DELETED" } });

    for (const id of [target.id, deleted.id]) {
      await expect(reactivateUser(actor(admin), id, "Reason")).rejects.toBeInstanceOf(
        InvalidAccountStateError,
      );
    }
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("requires a reason", async () => {
    const admin = await user("Admin", true);
    const target = await user("Lan");
    await suspendUser(actor(admin), target.id, "Spam");

    await expect(reactivateUser(actor(admin), target.id, " ")).rejects.toMatchObject({
      code: "REASON_REQUIRED",
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "SUSPENDED",
    );
  });

  it("refuses non-admins", async () => {
    const admin = await user("Admin", true);
    const plain = await user("Plain");
    const target = await user("Lan");
    await suspendUser(actor(admin), target.id, "Spam");

    await expect(reactivateUser(actor(plain), target.id, "Reason")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "SUSPENDED",
    );
  });
});
