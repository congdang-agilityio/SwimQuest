import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import { logIn } from "@/server/auth/login";
import { hashPassword } from "@/server/auth/password";
import { resetPassword, TEMPORARY_PASSWORD_LENGTH } from "./reset-password";

async function clean() {
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.xpEntry.deleteMany();
  await db.pointsEntry.deleteMany();
  await db.user.deleteMany();
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

const OLD_PASSWORD = "old-password-1";
let oldHash = "";
let n = 0;
const user = async (
  isPlatformAdmin = false,
  status: "ACTIVE" | "SUSPENDED" | "DELETED" = "ACTIVE",
) => {
  oldHash ||= await hashPassword(OLD_PASSWORD);
  return db.user.create({
    data: {
      email: `u${++n}@example.com`,
      passwordHash: oldHash,
      displayName: `User ${n}`,
      isPlatformAdmin,
      status,
    },
  });
};
const actor = (u: { id: string; isPlatformAdmin: boolean }) => ({
  id: u.id,
  isPlatformAdmin: u.isPlatformAdmin,
});
const session = (userId: string, tokenHash: string) =>
  db.session.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + 3_600_000) } });

describe("resetPassword", () => {
  it("sets a 12-character temporary password that logs in, flags a forced change and ends sessions", async () => {
    const admin = await user(true);
    const player = await user();
    await session(player.id, "p1");
    await session(player.id, "p2");
    await session(admin.id, "a1");

    const { temporaryPassword } = await resetPassword(actor(admin), player.id);

    expect(temporaryPassword).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
    expect(temporaryPassword).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]{12}$/);
    expect(TEMPORARY_PASSWORD_LENGTH).toBe(12);
    const stored = await db.user.findUniqueOrThrow({ where: { id: player.id } });
    expect(stored.mustChangePassword).toBe(true);
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(temporaryPassword);
    expect(await db.session.count({ where: { userId: player.id } })).toBe(0);
    expect(await db.session.count({ where: { userId: admin.id } })).toBe(1);

    const ok = await logIn({ email: player.email, password: temporaryPassword });
    expect(ok).toMatchObject({ ok: true, user: { id: player.id } });
    const old = await logIn({ email: player.email, password: OLD_PASSWORD });
    expect(old).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
  });

  it("generates a different temporary password each time", async () => {
    const admin = await user(true);
    const player = await user();

    const a = await resetPassword(actor(admin), player.id);
    const b = await resetPassword(actor(admin), player.id);

    expect(a.temporaryPassword).not.toBe(b.temporaryPassword);
    const ok = await logIn({ email: player.email, password: b.temporaryPassword });
    expect(ok.ok).toBe(true);
    expect((await logIn({ email: player.email, password: a.temporaryPassword })).ok).toBe(false);
  });

  it("records PASSWORD_RESET_BY_ADMIN with admin, player and time but no secret", async () => {
    const admin = await user(true);
    const player = await user();

    const { temporaryPassword } = await resetPassword(actor(admin), player.id);

    const events = await db.auditEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorType: "USER",
      actorUserId: admin.id,
      action: "PASSWORD_RESET_BY_ADMIN",
      entityType: "User",
      entityId: player.id,
    });
    expect(events[0].createdAt).toBeInstanceOf(Date);
    const stored = await db.user.findUniqueOrThrow({ where: { id: player.id } });
    const text = JSON.stringify(events[0]);
    expect(text).not.toContain(temporaryPassword);
    expect(text).not.toContain(stored.passwordHash);
    expect(text).not.toContain(oldHash);
    expect(text).not.toMatch(/argon2/);
    expect(text).not.toMatch(/"(password|passwordHash|temporaryPassword)"/i);
  });

  it("refuses a non-admin, a suspended admin, a forged flag and an unknown caller", async () => {
    const player = await user();
    const target = await user();
    const suspended = await user(true, "SUSPENDED");
    await session(target.id, "t1");
    const callers = [
      actor(player),
      { id: player.id, isPlatformAdmin: true },
      actor(suspended),
      { id: "unknown", isPlatformAdmin: true },
      undefined,
    ];

    for (const caller of callers) {
      await expect(
        resetPassword(caller as { id: string; isPlatformAdmin: boolean }, target.id),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
    const stored = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.passwordHash).toBe(oldHash);
    expect(stored.mustChangePassword).toBe(false);
    expect(await db.session.count()).toBe(1);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("returns NotFoundError for an unknown or malformed user id and changes nothing", async () => {
    const admin = await user(true);

    for (const id of ["nope", "", "x".repeat(101), 42]) {
      await expect(resetPassword(actor(admin), id as string)).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("returns NotFoundError for a DELETED user and changes nothing", async () => {
    const admin = await user(true);
    const deleted = await user(false, "DELETED");
    await session(deleted.id, "d1");

    await expect(resetPassword(actor(admin), deleted.id)).rejects.toBeInstanceOf(NotFoundError);

    const stored = await db.user.findUniqueOrThrow({ where: { id: deleted.id } });
    expect(stored.passwordHash).toBe(oldHash);
    expect(stored.mustChangePassword).toBe(false);
    expect(await db.session.count({ where: { userId: deleted.id } })).toBe(1);
    expect(await db.auditEvent.count()).toBe(0);
  });
});
