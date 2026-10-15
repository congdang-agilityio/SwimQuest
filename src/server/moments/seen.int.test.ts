import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { hasSeen, isValidMomentKey, markSeen, unseenKeys } from "./seen";

async function clean() {
  await db.seenMoment.deleteMany();
  await db.user.deleteMany();
}
const mkUser = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

describe("seen moments", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("is unseen, then seen after markSeen", async () => {
    const u = await mkUser("a");
    expect(await hasSeen(u.id, "tier:t1:2")).toBe(false);
    await markSeen(u.id, "tier:t1:2");
    expect(await hasSeen(u.id, "tier:t1:2")).toBe(true);
  });

  it("markSeen twice is harmless", async () => {
    const u = await mkUser("a");
    await markSeen(u.id, "finish:t1");
    await markSeen(u.id, "finish:t1");
    expect(await db.seenMoment.count({ where: { userId: u.id } })).toBe(1);
  });

  it("does not affect another user", async () => {
    const a = await mkUser("a");
    const b = await mkUser("b");
    await markSeen(a.id, "chest:c1");
    expect(await hasSeen(b.id, "chest:c1")).toBe(false);
    expect(await unseenKeys(b.id, ["chest:c1"])).toEqual(["chest:c1"]);
  });

  it("unseenKeys returns only the keys not yet seen, in order", async () => {
    const u = await mkUser("a");
    await markSeen(u.id, "tier:x:2");
    expect(await unseenKeys(u.id, ["tier:x:2", "tier:x:3", "finish-lost:x"])).toEqual([
      "tier:x:3",
      "finish-lost:x",
    ]);
    expect(await unseenKeys(u.id, [])).toEqual([]);
  });

  it("rejects unknown prefixes and over-long keys", async () => {
    const u = await mkUser("a");
    expect(isValidMomentKey("tier:a")).toBe(true);
    expect(isValidMomentKey("finish-lost:a")).toBe(true);
    expect(isValidMomentKey("bogus:a")).toBe(false);
    expect(isValidMomentKey("tier:")).toBe(false);
    expect(isValidMomentKey(`tier:${"a".repeat(200)}`)).toBe(false);
    expect(isValidMomentKey(5)).toBe(false);
    await expect(markSeen(u.id, "bogus:a")).rejects.toThrow();
    await expect(hasSeen(u.id, "bogus:a")).rejects.toThrow();
  });
});
