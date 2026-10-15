import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { PUBLIC_PLAYER_SELECT, toPublicPlayer } from "./public-player";

describe("public player projection (database)", () => {
  beforeEach(async () => {
    await db.auditEvent.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns no email from a query using PUBLIC_PLAYER_SELECT", async () => {
    const created = await db.user.create({
      data: { email: "lan@example.com", passwordHash: "hash", displayName: "Lan" },
    });

    const rows = await db.user.findMany({ select: PUBLIC_PLAYER_SELECT });

    expect(rows).toEqual([{ id: created.id, displayName: "Lan" }]);
    expect(JSON.stringify(rows)).not.toContain("lan@example.com");
    expect(rows.map(toPublicPlayer)).toEqual([{ id: created.id, displayName: "Lan" }]);
  });
});
