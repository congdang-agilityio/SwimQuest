import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { verifyPassword } from "./password";
import { findValidSession } from "./session";
import { signUp } from "./signup";

const input = { email: " Lan@Example.com ", password: "correct horse", displayName: " Lan " };

describe("signUp", () => {
  beforeEach(async () => {
    await db.$executeRaw`TRUNCATE "AuditEvent"`;
    await db.session.deleteMany();
    await db.xpEntry.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates an active user and a session that is valid at once", async () => {
    const result = await signUp(input);

    if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.errors)}`);
    expect(result.user).toMatchObject({
      email: "lan@example.com",
      displayName: "Lan",
      status: "ACTIVE",
    });
    expect(result.user).not.toHaveProperty("passwordHash");
    const session = await findValidSession(result.sessionToken);
    expect(session?.user.id).toBe(result.user.id);
  });

  it("stores an argon2id hash, never the plain password", async () => {
    await signUp(input);

    const stored = await db.user.findUniqueOrThrow({ where: { email: "lan@example.com" } });
    expect(stored.passwordHash).not.toBe(input.password);
    expect(stored.passwordHash).not.toContain(input.password);
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(stored.passwordHash, input.password)).resolves.toBe(true);
  });

  it("returns EMAIL_TAKEN for an existing email and creates nothing", async () => {
    await signUp(input);

    const second = await signUp({ ...input, email: "LAN@example.COM", displayName: "Other" });

    expect(second).toEqual({ ok: false, errors: { email: "EMAIL_TAKEN" } });
    await expect(db.user.count()).resolves.toBe(1);
    await expect(db.session.count()).resolves.toBe(1);
  });

  it("returns EMAIL_TAKEN for one of two concurrent sign-ups with the same email", async () => {
    const results = await Promise.all([signUp(input), signUp(input)]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, errors: { email: "EMAIL_TAKEN" } }]);
    await expect(db.user.count()).resolves.toBe(1);
    await expect(db.session.count()).resolves.toBe(1);
  });

  it("returns field errors for invalid input and creates nothing", async () => {
    const result = await signUp({ email: "nope", password: "short", displayName: "" });

    expect(result).toEqual({
      ok: false,
      errors: {
        email: "EMAIL_INVALID",
        password: "PASSWORD_TOO_SHORT",
        displayName: "DISPLAY_NAME_REQUIRED",
      },
    });
    await expect(db.user.count()).resolves.toBe(0);
  });

  it("allows two users with the same display name", async () => {
    await signUp(input);
    const other = await signUp({ ...input, email: "other@example.com" });
    expect(other.ok).toBe(true);
  });
});
