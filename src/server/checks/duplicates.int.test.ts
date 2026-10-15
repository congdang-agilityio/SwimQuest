import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { findDuplicateOf } from "./duplicates";

const HASH = "a".repeat(64);
const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00+07:00`);

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: "hash", displayName: email } });
}

async function makeSwim(userId: string, hash: string, start: string, end: string, dupOf?: string) {
  return db.swim.create({
    data: {
      userId,
      source: "GPX",
      fileSha256: hash,
      originalFilename: "swim.gpx",
      startedAt: at(start),
      endedAt: at(end),
      distanceM: 1000,
      durationS: 1800,
      swimType: "POOL",
      sport: "swimming",
      isSwim: true,
      duplicateOfId: dupOf,
    },
  });
}

describe("findDuplicateOf", () => {
  beforeEach(async () => {
    await db.swim.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
  });
  afterAll(async () => {
    await db.swim.deleteMany();
    await db.user.deleteMany();
    await db.$disconnect();
  });

  it("matches the same file even when the times differ", async () => {
    const user = await makeUser("a@example.com");
    const original = await makeSwim(user.id, HASH, "06:00", "06:30");
    const found = await findDuplicateOf(db, user.id, {
      fileSha256: HASH,
      startedAt: at("09:00"),
      endedAt: at("09:30"),
    });
    expect(found).toBe(original.id);
  });

  it("matches an overlapping time range", async () => {
    const user = await makeUser("a@example.com");
    const original = await makeSwim(user.id, "b".repeat(64), "06:00", "06:30");
    const found = await findDuplicateOf(db, user.id, {
      fileSha256: HASH,
      startedAt: at("06:20"),
      endedAt: at("06:50"),
    });
    expect(found).toBe(original.id);
  });

  it("does not match touching intervals", async () => {
    const user = await makeUser("a@example.com");
    await makeSwim(user.id, "b".repeat(64), "06:00", "06:30");
    const input = { fileSha256: HASH, startedAt: at("06:30"), endedAt: at("07:00") };
    expect(await findDuplicateOf(db, user.id, input)).toBeNull();
    const before = { fileSha256: HASH, startedAt: at("05:30"), endedAt: at("06:00") };
    expect(await findDuplicateOf(db, user.id, before)).toBeNull();
  });

  it("never matches another player's swim", async () => {
    const user = await makeUser("a@example.com");
    const other = await makeUser("b@example.com");
    await makeSwim(other.id, HASH, "06:00", "06:30");
    const found = await findDuplicateOf(db, user.id, {
      fileSha256: HASH,
      startedAt: at("06:00"),
      endedAt: at("06:30"),
    });
    expect(found).toBeNull();
  });

  it("ignores swims already marked duplicate and the excluded swim", async () => {
    const user = await makeUser("a@example.com");
    const original = await makeSwim(user.id, HASH, "06:00", "06:30");
    const copy = await makeSwim(user.id, HASH, "06:00", "06:30", original.id);
    const input = { fileSha256: HASH, startedAt: at("06:00"), endedAt: at("06:30") };
    expect(await findDuplicateOf(db, user.id, input, original.id)).toBeNull();
    expect(await findDuplicateOf(db, user.id, input, copy.id)).toBe(original.id);
  });
});
