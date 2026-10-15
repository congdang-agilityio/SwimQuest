import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { db } from "../db";
import { AUDIT_ACTIONS, recordAudit } from "./record";

describe("recordAudit (database)", () => {
  beforeEach(async () => {
    await db.auditEvent.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("stores a user action with all given fields and a database timestamp", async () => {
    const user = await db.user.create({
      data: { email: "org@example.com", passwordHash: "hash", displayName: "Org" },
    });
    const startedAt = new Date(Date.now() - 1000);

    await db.$transaction((tx) =>
      recordAudit(tx, {
        actor: { type: "USER", userId: user.id },
        action: AUDIT_ACTIONS.TEAM_CAPTAIN_SET,
        entityType: "Team",
        entityId: "team-1",
        tournamentId: "tour-1",
        before: { captainId: null },
        after: { captainId: "player-1" },
        reason: "Organizer choice",
      }),
    );

    const rows = await db.auditEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorType: "USER",
      actorUserId: user.id,
      action: "TEAM_CAPTAIN_SET",
      entityType: "Team",
      entityId: "team-1",
      tournamentId: "tour-1",
      before: { captainId: null },
      after: { captainId: "player-1" },
      reason: "Organizer choice",
    });
    expect(rows[0].createdAt.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
  });

  it("lets the database set createdAt: the INSERT binds no createdAt value", async () => {
    const logged = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: [{ emit: "event", level: "query" }],
    });
    const inserts: string[] = [];
    logged.$on("query", (e) => {
      if (e.query.includes('INSERT INTO "public"."AuditEvent"')) inserts.push(e.query);
    });
    try {
      await logged.$transaction((tx) =>
        recordAudit(tx, {
          actor: { type: "SYSTEM" },
          action: AUDIT_ACTIONS.TEAM_START_AUTO_ASSIGNED,
          entityType: "Team",
          entityId: "team-db-clock",
        }),
      );
    } finally {
      await logged.$disconnect();
    }

    expect(inserts).toHaveLength(1);
    expect(inserts[0].split(" VALUES ")[0]).not.toContain('"createdAt"');
    expect(await db.auditEvent.count()).toBe(1);
  });

  it("stores a system action without a user and with empty optional fields", async () => {
    await db.$transaction((tx) =>
      recordAudit(tx, {
        actor: { type: "SYSTEM" },
        action: AUDIT_ACTIONS.TEAM_START_AUTO_ASSIGNED,
        entityType: "Team",
        entityId: "team-2",
      }),
    );

    const rows = await db.auditEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorType: "SYSTEM",
      actorUserId: null,
      action: "TEAM_START_AUTO_ASSIGNED",
      entityType: "Team",
      entityId: "team-2",
      tournamentId: null,
      before: null,
      after: null,
      reason: null,
    });
  });

  it("leaves no audit row when the transaction rolls back", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await recordAudit(tx, {
          actor: { type: "SYSTEM" },
          action: AUDIT_ACTIONS.TEAM_START_AUTO_ASSIGNED,
          entityType: "Team",
          entityId: "team-3",
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await db.auditEvent.count()).toBe(0);
  });
});
