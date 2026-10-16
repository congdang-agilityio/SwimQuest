import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/auth/roles";
import {
  getUserForAdmin,
  InvalidCursorError,
  LastAdminError,
  searchUsers,
  setPlatformAdmin,
} from "./users";

async function clean() {
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

const user = (name: string, email = `${name.toLowerCase()}@example.com`, isPlatformAdmin = false) =>
  db.user.create({ data: { email, passwordHash: "h", displayName: name, isPlatformAdmin } });
const admin = (name = "Admin") => user(name, undefined, true);
const actor = (u: { id: string; isPlatformAdmin: boolean }) => ({
  id: u.id,
  isPlatformAdmin: u.isPlatformAdmin,
});

describe("searchUsers", () => {
  it("finds users by display name, case-insensitive, with the admin view fields", async () => {
    const a = await admin();
    const lan = await user("Nguyen Lan", "lan@example.com");
    await user("Minh", "minh@example.com");

    const page = await searchUsers(actor(a), { q: "nGuYeN" });

    expect(page.nextCursor).toBeNull();
    expect(page.items).toEqual([
      {
        id: lan.id,
        displayName: "Nguyen Lan",
        email: "lan@example.com",
        status: "ACTIVE",
        isPlatformAdmin: false,
        createdAt: lan.createdAt.toISOString(),
      },
    ]);
  });

  it("finds users by email, case-insensitive", async () => {
    const a = await admin();
    const hoa = await user("Hoa", "hoa.swim@example.com");
    await user("Minh", "minh@example.com");

    const page = await searchUsers(actor(a), { q: "HOA.SWIM@" });

    expect(page.items.map((u) => u.id)).toEqual([hoa.id]);
  });

  it("lists everyone, newest first, 20 per page with a cursor and no repeats", async () => {
    const a = await admin();
    for (let i = 0; i < 22; i++) await user(`Swimmer ${i}`);

    const first = await searchUsers(actor(a), {});
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await searchUsers(actor(a), { cursor: first.nextCursor! });
    expect(second.items).toHaveLength(3);
    expect(second.nextCursor).toBeNull();

    const ids = [...first.items, ...second.items].map((u) => u.id);
    expect(new Set(ids).size).toBe(23);
  });

  it("rejects a malformed cursor and an over-long query", async () => {
    const a = await admin();
    await expect(searchUsers(actor(a), { cursor: "not-a-cursor" })).rejects.toThrow(
      InvalidCursorError,
    );
    await expect(searchUsers(actor(a), { q: "x".repeat(101) })).rejects.toThrow();
  });

  it("refuses a non-admin, and an admin whose role was removed in the database", async () => {
    const player = await user("Player");
    await expect(searchUsers(actor(player), {})).rejects.toThrow(ForbiddenError);
    // A caller claiming to be admin is still refused: the role is read from the database.
    await expect(searchUsers({ id: player.id, isPlatformAdmin: true }, {})).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("getUserForAdmin", () => {
  it("returns one user for an admin", async () => {
    const a = await admin();
    const lan = await user("Lan");
    expect(await getUserForAdmin(actor(a), lan.id)).toMatchObject({
      id: lan.id,
      email: "lan@example.com",
      isPlatformAdmin: false,
    });
  });

  it("throws NotFoundError for an unknown id", async () => {
    const a = await admin();
    await expect(getUserForAdmin(actor(a), "missing")).rejects.toThrow(NotFoundError);
  });

  it("refuses a non-admin", async () => {
    const player = await user("Player");
    const lan = await user("Lan");
    await expect(getUserForAdmin(actor(player), lan.id)).rejects.toThrow(ForbiddenError);
  });
});

describe("setPlatformAdmin", () => {
  it("grants the role at once and records who, whom, old and new role", async () => {
    const a = await admin();
    const lan = await user("Lan");

    const result = await setPlatformAdmin(actor(a), lan.id, true);

    expect(result.isPlatformAdmin).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: lan.id } })).isPlatformAdmin).toBe(true);
    // The new admin can use admin functions right away.
    await expect(searchUsers({ id: lan.id, isPlatformAdmin: false }, {})).resolves.toBeDefined();
    const rows = await db.auditEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorType: "USER",
      actorUserId: a.id,
      action: "ADMIN_ROLE_CHANGED",
      entityType: "User",
      entityId: lan.id,
      before: { isPlatformAdmin: false },
      after: { isPlatformAdmin: true },
    });
  });

  it("removes the role at once with an audit row", async () => {
    const a = await admin();
    const b = await admin("Second");

    await setPlatformAdmin(actor(a), b.id, false);

    await expect(searchUsers(actor(b), {})).rejects.toThrow(ForbiddenError);
    const rows = await db.auditEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: a.id,
      entityId: b.id,
      before: { isPlatformAdmin: true },
      after: { isPlatformAdmin: false },
    });
  });

  it("writes no audit row when nothing changes", async () => {
    const a = await admin();
    const lan = await user("Lan");
    await setPlatformAdmin(actor(a), lan.id, false);
    await setPlatformAdmin(actor(a), a.id, true);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("does not let the last admin remove themselves", async () => {
    const a = await admin();
    await expect(setPlatformAdmin(actor(a), a.id, false)).rejects.toThrow(LastAdminError);
    expect((await db.user.findUniqueOrThrow({ where: { id: a.id } })).isPlatformAdmin).toBe(true);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("lets an admin remove themselves while another active admin remains", async () => {
    const a = await admin();
    await admin("Second");
    await setPlatformAdmin(actor(a), a.id, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: a.id } })).isPlatformAdmin).toBe(false);
  });

  it("refuses a non-admin and changes nothing", async () => {
    const player = await user("Player");
    const lan = await user("Lan");
    await expect(setPlatformAdmin(actor(player), lan.id, true)).rejects.toThrow(ForbiddenError);
    await expect(setPlatformAdmin(actor(player), player.id, true)).rejects.toThrow(ForbiddenError);
    expect(await db.user.count({ where: { isPlatformAdmin: true } })).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("throws NotFoundError for an unknown user and rejects a non-boolean role", async () => {
    const a = await admin();
    await expect(setPlatformAdmin(actor(a), "missing", true)).rejects.toThrow(NotFoundError);
    await expect(setPlatformAdmin(actor(a), a.id, "yes" as unknown as boolean)).rejects.toThrow();
  });
});
