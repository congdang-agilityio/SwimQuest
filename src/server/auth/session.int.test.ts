import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { SESSION_TTL_MS, createSession, deleteSession, findValidSession } from "./session";

const HOUR = 60 * 60 * 1000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function makeUser(email = "session@example.com") {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: "Session" } });
}

describe("sessions", () => {
  beforeEach(async () => {
    await db.$executeRaw`TRUNCATE "AuditEvent"`;
    await db.session.deleteMany();
    await db.xpEntry.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates a 32-byte random token and stores only its SHA-256 hash", async () => {
    const user = await makeUser();
    const now = new Date("2026-10-01T00:00:00Z");

    const { token, expiresAt } = await createSession(user.id, now);

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(expiresAt.getTime()).toBe(now.getTime() + 30 * 24 * HOUR);
    expect(SESSION_TTL_MS).toBe(30 * 24 * HOUR);
    const stored = await db.session.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toBe(sha256(token));
    expect(stored[0].tokenHash).not.toContain(token);
    expect(stored[0].expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  it("creates a different token every time", async () => {
    const user = await makeUser();
    const a = await createSession(user.id);
    const b = await createSession(user.id);
    expect(a.token).not.toBe(b.token);
  });

  it("finds a valid session with its user, without the password hash", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);

    const found = await findValidSession(token);

    expect(found?.user).toEqual({
      id: user.id,
      email: user.email,
      displayName: "Session",
      status: "ACTIVE",
      isPlatformAdmin: false,
      mustChangePassword: false,
    });
    expect(found?.session.userId).toBe(user.id);
    expect(JSON.stringify(found)).not.toContain("passwordHash");
  });

  it.each([["unknown-token"], [""], ["x".repeat(5000)], [undefined], [42]])(
    "returns null for an unknown or malformed token %j",
    async (token) => {
      await expect(findValidSession(token as unknown as string)).resolves.toBeNull();
    },
  );

  it("returns null for an expired session", async () => {
    const user = await makeUser();
    const created = new Date("2026-10-01T00:00:00Z");
    const { token, expiresAt } = await createSession(user.id, created);

    await expect(
      findValidSession(token, new Date(expiresAt.getTime() - 1)),
    ).resolves.not.toBeNull();
    await expect(findValidSession(token, expiresAt)).resolves.toBeNull();
  });

  it.each([["SUSPENDED"], ["DELETION_PENDING"], ["DELETED"]] as const)(
    "returns null when the user is %s",
    async (status) => {
      const user = await makeUser();
      const { token } = await createSession(user.id);
      await db.user.update({ where: { id: user.id }, data: { status } });

      await expect(findValidSession(token)).resolves.toBeNull();
    },
  );

  it("refreshes lastSeenAt at most once per hour", async () => {
    const user = await makeUser();
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = await createSession(user.id, start);
    const lastSeen = async () =>
      (await db.session.findFirstOrThrow({ where: { userId: user.id } })).lastSeenAt.getTime();

    expect(await lastSeen()).toBe(start.getTime());

    await findValidSession(token, new Date(start.getTime() + HOUR - 1));
    expect(await lastSeen()).toBe(start.getTime());

    const later = new Date(start.getTime() + HOUR);
    await findValidSession(token, later);
    expect(await lastSeen()).toBe(later.getTime());

    await findValidSession(token, new Date(later.getTime() + 10 * 60 * 1000));
    expect(await lastSeen()).toBe(later.getTime());
  });

  it("deletes a session so its token no longer works", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    const other = await createSession(user.id);

    await deleteSession(token);

    await expect(findValidSession(token)).resolves.toBeNull();
    await expect(findValidSession(other.token)).resolves.not.toBeNull();
    await expect(deleteSession(token)).resolves.toBeUndefined();
  });
});
