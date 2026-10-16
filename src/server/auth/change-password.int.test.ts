import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { changePassword } from "./change-password";
import { logIn } from "./login";
import { hashPassword } from "./password";
import { createSession, findValidSession } from "./session";

const OLD = "old password 1";
const NEW = "brand new password";
const EMAIL = "lan@example.com";

async function clean() {
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.session.deleteMany();
  await db.user.deleteMany();
}

async function setUp(options: { mustChangePassword?: boolean } = {}) {
  const user = await db.user.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword(OLD),
      displayName: "Lan",
      status: "ACTIVE",
      mustChangePassword: options.mustChangePassword ?? false,
    },
  });
  const current = await createSession(user.id);
  const other = await createSession(user.id);
  const currentSession = await findValidSession(current.token);
  if (!currentSession) throw new Error("expected a valid session");
  return { user, currentSessionId: currentSession.session.id, current, other };
}

describe("changePassword", () => {
  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("changes the password: the old one no longer logs in, the new one does", async () => {
    const { user, currentSessionId } = await setUp();

    const result = await changePassword(user.id, currentSessionId, {
      current: OLD,
      next: NEW,
      confirm: NEW,
    });

    expect(result).toEqual({ ok: true });
    await expect(logIn({ email: EMAIL, password: OLD })).resolves.toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
    await expect(logIn({ email: EMAIL, password: NEW })).resolves.toMatchObject({ ok: true });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(NEW);
  });

  it("clears mustChangePassword when it was set", async () => {
    const { user, currentSessionId } = await setUp({ mustChangePassword: true });

    await changePassword(user.id, currentSessionId, { current: OLD, next: NEW, confirm: NEW });

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.mustChangePassword).toBe(false);
  });

  it("removes every other session of the user and keeps the current one", async () => {
    const { user, currentSessionId, current, other } = await setUp();
    const stranger = await db.user.create({
      data: { email: "other@example.com", passwordHash: "x", displayName: "Other" },
    });
    const strangerSession = await createSession(stranger.id);

    await changePassword(user.id, currentSessionId, { current: OLD, next: NEW, confirm: NEW });

    await expect(findValidSession(current.token)).resolves.not.toBeNull();
    await expect(findValidSession(other.token)).resolves.toBeNull();
    await expect(findValidSession(strangerSession.token)).resolves.not.toBeNull();
    await expect(db.session.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it.each([
    ["missing", undefined],
    ["unknown", "not-a-session-of-this-user"],
  ])("revokes every session of the user for a %s currentSessionId", async (_, sessionId) => {
    const { user, current, other } = await setUp();
    const stranger = await db.user.create({
      data: { email: "other@example.com", passwordHash: "x", displayName: "Other" },
    });
    const strangerSession = await createSession(stranger.id);

    const result = await changePassword(user.id, sessionId as never, {
      current: OLD,
      next: NEW,
      confirm: NEW,
    });

    expect(result).toEqual({ ok: true });
    await expect(db.session.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(findValidSession(current.token)).resolves.toBeNull();
    await expect(findValidSession(other.token)).resolves.toBeNull();
    await expect(findValidSession(strangerSession.token)).resolves.not.toBeNull();
  });

  it("lets exactly one of two concurrent changes win", async () => {
    const { user, currentSessionId } = await setUp();
    const candidates = ["first new password", "second new password"];

    const results = await Promise.all(
      candidates.map((next) =>
        changePassword(user.id, currentSessionId, { current: OLD, next, confirm: next }),
      ),
    );

    const winners = results.flatMap((result, i) => (result.ok ? [candidates[i]] : []));
    expect(winners).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, errors: { current: "WRONG_PASSWORD" } },
    ]);
    await expect(db.auditEvent.count({ where: { action: "PASSWORD_CHANGED" } })).resolves.toBe(1);
    const loser = candidates.find((candidate) => candidate !== winners[0]);
    await expect(logIn({ email: EMAIL, password: winners[0] })).resolves.toMatchObject({
      ok: true,
    });
    await expect(logIn({ email: EMAIL, password: loser as string })).resolves.toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
    await expect(logIn({ email: EMAIL, password: OLD })).resolves.toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
  });

  it("records PASSWORD_CHANGED without any password or hash", async () => {
    const { user, currentSessionId } = await setUp({ mustChangePassword: true });

    await changePassword(user.id, currentSessionId, { current: OLD, next: NEW, confirm: NEW });

    const rows = await db.auditEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorType: "USER",
      actorUserId: user.id,
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: user.id,
    });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const serialized = JSON.stringify(rows[0]);
    for (const secret of [OLD, NEW, stored.passwordHash, user.passwordHash, "argon2"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("returns WRONG_PASSWORD on current and changes nothing for a wrong current password", async () => {
    const { user, currentSessionId, other } = await setUp({ mustChangePassword: true });

    const result = await changePassword(user.id, currentSessionId, {
      current: "not the password",
      next: NEW,
      confirm: NEW,
    });

    expect(result).toEqual({ ok: false, errors: { current: "WRONG_PASSWORD" } });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toBe(user.passwordHash);
    expect(stored.mustChangePassword).toBe(true);
    await expect(findValidSession(other.token)).resolves.not.toBeNull();
    await expect(db.auditEvent.count()).resolves.toBe(0);
  });

  it("returns PASSWORD_MISMATCH on confirm and changes nothing when the entries differ", async () => {
    const { user, currentSessionId } = await setUp();

    const result = await changePassword(user.id, currentSessionId, {
      current: OLD,
      next: NEW,
      confirm: `${NEW}!`,
    });

    expect(result).toEqual({ ok: false, errors: { confirm: "PASSWORD_MISMATCH" } });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toBe(user.passwordHash);
    await expect(db.auditEvent.count()).resolves.toBe(0);
  });

  it.each([
    ["short", "short", "PASSWORD_TOO_SHORT"],
    ["empty", "", "PASSWORD_REQUIRED"],
    ["blank", "          ", "PASSWORD_BLANK"],
    ["too long", "a".repeat(129), "PASSWORD_TOO_LONG"],
  ])("returns the sign-up code on next for a %s new password", async (_, next, code) => {
    const { user, currentSessionId } = await setUp();

    const result = await changePassword(user.id, currentSessionId, {
      current: OLD,
      next,
      confirm: next,
    });

    expect(result).toEqual({ ok: false, errors: { next: code } });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toBe(user.passwordHash);
    await expect(db.auditEvent.count()).resolves.toBe(0);
  });

  it("rejects input that is not strings without changing anything", async () => {
    const { user, currentSessionId } = await setUp();

    const result = await changePassword(user.id, currentSessionId, {
      current: 42,
      next: null,
      confirm: undefined,
    } as never);

    expect(result).toEqual({
      ok: false,
      errors: { current: "WRONG_PASSWORD", next: "PASSWORD_REQUIRED" },
    });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toBe(user.passwordHash);
  });

  it("returns WRONG_PASSWORD for an unknown or inactive user", async () => {
    const { user, currentSessionId } = await setUp();
    await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });

    const inactive = await changePassword(user.id, currentSessionId, {
      current: OLD,
      next: NEW,
      confirm: NEW,
    });
    const unknown = await changePassword("missing", currentSessionId, {
      current: OLD,
      next: NEW,
      confirm: NEW,
    });

    expect(inactive).toEqual({ ok: false, errors: { current: "WRONG_PASSWORD" } });
    expect(unknown).toEqual({ ok: false, errors: { current: "WRONG_PASSWORD" } });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toBe(user.passwordHash);
  });
});
