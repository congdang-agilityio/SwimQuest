import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

// AuditEvent is append-only: DELETE is blocked by a trigger, so tests clear it with TRUNCATE.
async function clean() {
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.user.deleteMany();
}

async function setup() {
  const admin = await db.user.create({
    data: { email: "admin@example.com", passwordHash: "hash", displayName: "Admin" },
  });
  const event = await db.auditEvent.create({
    data: {
      actorType: "USER",
      actorUserId: admin.id,
      action: "tournament.publish",
      entityType: "Tournament",
      entityId: "t1",
      tournamentId: "t1",
      before: { status: "DRAFT" },
      after: { status: "PUBLISHED" },
      reason: "Ready",
    },
  });
  return { admin, event };
}

describe("AuditEvent append-only schema", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("allows inserting audit events", async () => {
    const { event } = await setup();
    const stored = await db.auditEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.action).toBe("tournament.publish");
    expect(stored.reason).toBe("Ready");
  });

  it.each([
    ["action", `UPDATE "AuditEvent" SET "action" = 'tampered' WHERE "id" = $1`],
    ["reason", `UPDATE "AuditEvent" SET "reason" = 'tampered' WHERE "id" = $1`],
    ["after", `UPDATE "AuditEvent" SET "after" = '{"status":"DRAFT"}'::jsonb WHERE "id" = $1`],
    ["createdAt", `UPDATE "AuditEvent" SET "createdAt" = now() - interval '1 day' WHERE "id" = $1`],
  ])("rejects a raw UPDATE of %s", async (_column, sql) => {
    const { event } = await setup();
    await expect(db.$executeRawUnsafe(sql, event.id)).rejects.toThrow(/append-only/);
    const stored = await db.auditEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.action).toBe("tournament.publish");
    expect(stored.reason).toBe("Ready");
    expect(stored.after).toEqual({ status: "PUBLISHED" });
    expect(stored.createdAt).toEqual(event.createdAt);
  });

  it("rejects setting actorUserId to null together with another column", async () => {
    const { event } = await setup();
    await expect(
      db.$executeRawUnsafe(
        `UPDATE "AuditEvent" SET "actorUserId" = NULL, "reason" = 'x' WHERE "id" = $1`,
        event.id,
      ),
    ).rejects.toThrow(/append-only/);
  });

  it("rejects changing actorUserId to another user", async () => {
    const { event } = await setup();
    const other = await db.user.create({
      data: { email: "other@example.com", passwordHash: "hash", displayName: "Other" },
    });
    await expect(
      db.$executeRawUnsafe(
        `UPDATE "AuditEvent" SET "actorUserId" = $2 WHERE "id" = $1`,
        event.id,
        other.id,
      ),
    ).rejects.toThrow(/append-only/);
  });

  it("rejects updates through the Prisma client", async () => {
    const { event } = await setup();
    await expect(
      db.auditEvent.update({ where: { id: event.id }, data: { reason: "tampered" } }),
    ).rejects.toThrow(/append-only/);
  });

  it("rejects a raw DELETE", async () => {
    const { event } = await setup();
    await expect(
      db.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE "id" = $1`, event.id),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditEvent.deleteMany()).rejects.toThrow(/append-only/);
    expect(await db.auditEvent.count()).toBe(1);
  });

  it("keeps the event and nulls actorUserId when the actor user is deleted", async () => {
    const { admin, event } = await setup();
    await db.user.delete({ where: { id: admin.id } });
    const stored = await db.auditEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.actorUserId).toBeNull();
    expect(stored.action).toBe("tournament.publish");
    expect(stored.reason).toBe("Ready");
    expect(stored.after).toEqual({ status: "PUBLISHED" });
  });

  it("has the audit log filter indexes", async () => {
    const rows = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'AuditEvent'`;
    const defs = rows.map((r) => r.indexdef.replace(/^.* USING btree /, ""));
    expect(defs).toEqual(
      expect.arrayContaining([
        `("createdAt")`,
        `("tournamentId", "createdAt")`,
        `("actorUserId", "createdAt")`,
        `(action, "createdAt")`,
      ]),
    );
  });
});
