import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "./db";

describe("database baseline schema", () => {
  beforeEach(async () => {
    await db.$executeRaw`TRUNCATE "AuditEvent"`;
    await db.session.deleteMany();
    await db.xpEntry.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates a user with defaults and reads it back", async () => {
    const created = await db.user.create({
      data: { email: "swimmer@example.com", passwordHash: "hash", displayName: "Swimmer" },
    });

    const found = await db.user.findUnique({ where: { email: "swimmer@example.com" } });

    expect(found).toMatchObject({
      id: created.id,
      displayName: "Swimmer",
      status: "ACTIVE",
      isPlatformAdmin: false,
    });
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.updatedAt).toBeInstanceOf(Date);
  });

  it("stores emails lower-cased", async () => {
    const user = await db.user.create({
      data: { email: "Mixed.Case@Example.COM", passwordHash: "hash", displayName: "Mixed" },
    });

    expect(user.email).toBe("mixed.case@example.com");
    await expect(
      db.user.findUnique({ where: { email: "mixed.case@example.com" } }),
    ).resolves.toMatchObject({ id: user.id });
  });

  it("rejects a duplicate email, also when only the case differs", async () => {
    await db.user.create({
      data: { email: "dup@example.com", passwordHash: "hash", displayName: "One" },
    });

    const duplicate = db.user.create({
      data: { email: "DUP@example.com", passwordHash: "hash", displayName: "Two" },
    });

    await expect(duplicate).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(duplicate).rejects.toMatchObject({ code: "P2002" });
  });

  it("lower-cases emails written by createMany and createManyAndReturn", async () => {
    await db.user.createMany({
      data: [{ email: "Bulk.One@Example.com", passwordHash: "hash", displayName: "One" }],
    });
    const [two] = await db.user.createManyAndReturn({
      data: [{ email: "Bulk.Two@Example.com", passwordHash: "hash", displayName: "Two" }],
    });

    expect(two.email).toBe("bulk.two@example.com");
    const emails = (await db.user.findMany({ orderBy: { email: "asc" } })).map((u) => u.email);
    expect(emails).toEqual(["bulk.one@example.com", "bulk.two@example.com"]);
  });

  it("lower-cases emails written by update with set and by updateMany", async () => {
    const user = await db.user.create({
      data: { email: "first@example.com", passwordHash: "hash", displayName: "First" },
    });

    const updated = await db.user.update({
      where: { id: user.id },
      data: { email: { set: "Second@Example.com" } },
    });
    expect(updated.email).toBe("second@example.com");

    await db.user.updateMany({ where: { id: user.id }, data: { email: "Third@Example.com" } });
    await expect(db.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      email: "third@example.com",
    });
  });

  it("rejects a mixed-case email written outside the client extension", async () => {
    const insert = db.$executeRaw`
      INSERT INTO "User" ("id", "email", "passwordHash", "displayName", "updatedAt")
      VALUES ('raw-user', 'Raw@Example.com', 'hash', 'Raw', now())`;

    await expect(insert).rejects.toThrow(/User_email_lowercase_check/);
  });

  it("creates a session for a user and reads it back with its user", async () => {
    const user = await db.user.create({
      data: { email: "session@example.com", passwordHash: "hash", displayName: "Session" },
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.session.create({ data: { tokenHash: "token-hash", userId: user.id, expiresAt } });

    const session = await db.session.findUnique({
      where: { tokenHash: "token-hash" },
      include: { user: true },
    });
    expect(session?.user.id).toBe(user.id);
    expect(session?.expiresAt.toISOString()).toBe(expiresAt.toISOString());
    expect(session?.lastSeenAt).toBeInstanceOf(Date);
    expect(session?.createdAt).toBeInstanceOf(Date);
  });

  it("deletes a user's sessions when the user is deleted", async () => {
    const user = await db.user.create({
      data: { email: "cascade@example.com", passwordHash: "hash", displayName: "Cascade" },
    });
    await db.session.create({
      data: { tokenHash: "cascade-hash", userId: user.id, expiresAt: new Date() },
    });

    await db.user.delete({ where: { id: user.id } });

    await expect(db.session.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("records audit events from users and the system", async () => {
    const user = await db.user.create({
      data: { email: "audit@example.com", passwordHash: "hash", displayName: "Audit" },
    });

    await db.auditEvent.create({
      data: {
        actorType: "USER",
        actorUserId: user.id,
        action: "user.update",
        entityType: "User",
        entityId: user.id,
        before: { displayName: "Old" },
        after: { displayName: "Audit" },
        reason: "profile edit",
      },
    });
    await db.auditEvent.create({
      data: { actorType: "SYSTEM", action: "user.suspend", entityType: "User", entityId: user.id },
    });

    const events = await db.auditEvent.findMany({
      where: { entityType: "User", entityId: user.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ actorUserId: user.id, after: { displayName: "Audit" } });
    expect(events[1]).toMatchObject({ actorType: "SYSTEM", actorUserId: null, tournamentId: null });
  });
});
