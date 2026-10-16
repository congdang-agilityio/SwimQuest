import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError } from "@/server/auth/roles";
import {
  ADMIN_CONTACT_SETTING_KEY,
  AdminContactError,
  getAdminContact,
  setAdminContact,
} from "./admin-contact";

async function clean() {
  await db.$executeRaw`TRUNCATE "AuditEvent"`;
  await db.platformSetting.deleteMany();
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

let n = 0;
const user = (isPlatformAdmin: boolean, status: "ACTIVE" | "SUSPENDED" = "ACTIVE") =>
  db.user.create({
    data: {
      email: `c${++n}@example.com`,
      passwordHash: "h",
      displayName: `User ${n}`,
      isPlatformAdmin,
      status,
    },
  });
const actor = (u: { id: string; isPlatformAdmin: boolean }) => ({
  id: u.id,
  isPlatformAdmin: u.isPlatformAdmin,
});

describe("getAdminContact", () => {
  it("returns an empty string when nothing is stored", async () => {
    expect(await getAdminContact()).toBe("");
  });

  it("returns an empty string when the stored value is not text", async () => {
    await db.platformSetting.create({ data: { key: ADMIN_CONTACT_SETTING_KEY, value: { x: 1 } } });
    expect(await getAdminContact()).toBe("");
  });
});

describe("setAdminContact", () => {
  it("stores the trimmed contact and audits ADMIN_CONTACT_CHANGED with old and new text", async () => {
    const admin = await user(true);
    const text = "Zalo 0901 234 567\nor ask the pool desk";

    expect(await setAdminContact(actor(admin), `  ${text}  `)).toBe(text);
    expect(await getAdminContact()).toBe(text);
    await setAdminContact(actor(admin), "Call Lan");

    expect(await getAdminContact()).toBe("Call Lan");
    const events = await db.auditEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      actorType: "USER",
      actorUserId: admin.id,
      action: "ADMIN_CONTACT_CHANGED",
      entityType: "PlatformSetting",
      entityId: ADMIN_CONTACT_SETTING_KEY,
      before: { contact: "" },
      after: { contact: text },
    });
    expect(events.map((e) => e.after)).toContainEqual({ contact: "Call Lan" });
    expect(events.map((e) => e.before)).toContainEqual({ contact: text });
  });

  it("accepts exactly 200 characters and an empty contact (cleared)", async () => {
    const admin = await user(true);
    const max = "x".repeat(200);

    expect(await setAdminContact(actor(admin), max)).toBe(max);
    expect(await setAdminContact(actor(admin), "   ")).toBe("");
    expect(await getAdminContact()).toBe("");
    expect(await db.auditEvent.count()).toBe(2);
  });

  it("normalizes CRLF line breaks from a form post to LF before validation", async () => {
    const admin = await user(true);

    expect(await setAdminContact(actor(admin), "Zalo 0901\r\nor the desk\r\n")).toBe(
      "Zalo 0901\nor the desk",
    );
    expect(await getAdminContact()).toBe("Zalo 0901\nor the desk");
  });

  it("does not audit when the contact did not change", async () => {
    const admin = await user(true);
    await setAdminContact(actor(admin), "Call Lan");
    await setAdminContact(actor(admin), " Call Lan ");

    expect(await db.auditEvent.count()).toBe(1);
  });

  it("refuses text over 200 characters, non-text and control characters, saving nothing", async () => {
    const admin = await user(true);
    const bad = ["x".repeat(201), 42, null, undefined, { a: 1 }, "bell\u0007", "nul\u0000"];
    const c1AndBidi = [
      "csi\u009b",
      "nel\u0085",
      "rlo\u202e09",
      "lre\u202a",
      "rli\u2067",
      "pdi\u2069",
    ];
    for (const value of [...bad, ...c1AndBidi, "lone\rcr"]) {
      const err = await setAdminContact(actor(admin), value as string).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AdminContactError);
      expect(err).toMatchObject({ status: 400, code: "INVALID_ADMIN_CONTACT" });
    }
    expect(await db.platformSetting.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("refuses a non-admin, a suspended admin, a forged flag and an unknown caller", async () => {
    const player = await user(false);
    const suspended = await user(true, "SUSPENDED");
    const callers = [
      actor(player),
      { id: player.id, isPlatformAdmin: true },
      actor(suspended),
      { id: "unknown", isPlatformAdmin: true },
    ];
    for (const caller of callers) {
      await expect(setAdminContact(caller, "Call me")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.platformSetting.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });
});
