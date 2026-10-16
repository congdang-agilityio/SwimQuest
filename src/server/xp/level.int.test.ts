import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getLevels } from "./level";

async function clean() {
  await db.xpEntry.deleteMany();
  await db.user.deleteMany();
}

const user = (n: string) =>
  db.user.create({ data: { email: `${n}@example.com`, passwordHash: "h", displayName: n } });

describe("getLevels", () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("returns xp, level and xpToNext for several users, level 1 without XP", async () => {
    const [a, b, c] = await Promise.all(["a", "b", "c"].map(user));
    await db.xpEntry.create({ data: { userId: a.id, kind: "DISTANCE", xp: 50 } });
    await db.xpEntry.create({ data: { userId: b.id, kind: "DISTANCE", xp: 149 } });
    await db.xpEntry.create({ data: { userId: b.id, kind: "FIRST_SWIM_BONUS", xp: 1 } });
    const levels = await getLevels([a.id, b.id, c.id, a.id]);
    expect(levels.size).toBe(3);
    expect(levels.get(a.id)).toEqual({ xp: 50, level: 2, xpToNext: 100 });
    expect(levels.get(b.id)).toEqual({ xp: 150, level: 3, xpToNext: 150 });
    expect(levels.get(c.id)).toEqual({ xp: 0, level: 1, xpToNext: 50 });
  });

  it("lowers the level after a reversal", async () => {
    const a = await user("a");
    const e = await db.xpEntry.create({ data: { userId: a.id, kind: "DISTANCE", xp: 60 } });
    expect((await getLevels([a.id])).get(a.id)!.level).toBe(2);
    await db.xpEntry.create({
      data: { userId: a.id, kind: "REVERSAL", xp: -60, reversesId: e.id },
    });
    expect((await getLevels([a.id])).get(a.id)).toEqual({ xp: 0, level: 1, xpToNext: 50 });
  });

  it("handles an empty list", async () => {
    expect((await getLevels([])).size).toBe(0);
  });
});
