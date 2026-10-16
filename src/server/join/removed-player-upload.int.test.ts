import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createSwimFromUpload } from "@/server/swims/create-from-upload";
import {
  addMember,
  cleanJoinRows,
  endedMembership,
  tournamentWithTeams,
  user,
} from "./__tests__/fixtures";

const gpx = readFileSync(join(__dirname, "../swims/parse/__tests__/fixtures/open-water.gpx"));

describe("uploads after a removal after the start (S-41 AC 3)", () => {
  beforeEach(cleanJoinRows);
  afterAll(async () => {
    await cleanJoinRows();
    await db.$disconnect();
  });

  it("creates no result in the tournament the player was removed from", async () => {
    const { tournament, teams } = await tournamentWithTeams("PUBLISHED", [2, 2]);
    const removed = await user("removed");
    await endedMembership(
      teams[0].id,
      tournament.id,
      removed.id,
      "REMOVED_AFTER_START",
      new Date("2026-10-05T00:00:00Z"),
      new Date("2026-10-10T00:00:00Z"),
    );
    const member = await addMember(teams[0].id, tournament.id, "member");

    const swim = await createSwimFromUpload(removed.id, { buffer: gpx, filename: "a.gpx" });
    const control = await createSwimFromUpload(member.id, { buffer: gpx, filename: "a.gpx" });

    expect(await db.swim.count({ where: { id: swim.id } })).toBe(1);
    expect(await db.swimResult.count({ where: { swimId: swim.id } })).toBe(0);
    expect(await db.swimResult.count({ where: { userId: removed.id } })).toBe(0);
    expect(await db.pointsEntry.count({ where: { userId: removed.id } })).toBe(0);
    // An active member's upload does get a result there, so the check above is meaningful.
    expect(
      await db.swimResult.count({ where: { swimId: control.id, tournamentId: tournament.id } }),
    ).toBe(1);
  });
});
