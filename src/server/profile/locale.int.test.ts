import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getUserLocale, setUserLocale } from "./locale";

describe("user locale", () => {
  beforeEach(async () => {
    await db.session.deleteMany();
    await db.user.deleteMany();
  });
  afterAll(async () => {
    await db.session.deleteMany();
    await db.user.deleteMany();
    await db.$disconnect();
  });

  it("is null until chosen, then returns what was saved", async () => {
    const u = await db.user.create({
      data: { email: "a@example.com", passwordHash: "h", displayName: "A" },
    });
    expect(await getUserLocale(u.id)).toBeNull();
    await setUserLocale(u.id, "en");
    expect(await getUserLocale(u.id)).toBe("en");
  });
});
