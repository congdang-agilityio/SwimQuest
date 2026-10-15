import type { SwimResultStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { db } from "../db";
import { emitEvent } from "./emit";
import { clearHandlers, registerHandler } from "./handlers";
import type { DomainEventMap } from "./types";

const progress = { tournamentId: "t1", teamId: "team1", fromBp: 100, toBp: 250 };

describe("emitEvent (database)", () => {
  beforeEach(async () => {
    clearHandlers();
    await db.domainEvent.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    clearHandlers();
    await db.domainEvent.deleteMany();
    await db.$disconnect();
  });

  it("stores the event row with type, tournament and payload", async () => {
    await db.$transaction((tx) =>
      emitEvent(tx, { type: "TEAM_PROGRESS_CHANGED", payload: progress }),
    );

    const rows = await db.domainEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "TEAM_PROGRESS_CHANGED",
      tournamentId: "t1",
      payload: progress,
    });
  });

  it("stores a null tournament for a global event", async () => {
    const payload = { userId: "u1", fromLevel: 1, toLevel: 2 };
    await db.$transaction((tx) => emitEvent(tx, { type: "LEVEL_CHANGED", payload }));

    const rows = await db.domainEvent.findMany();
    expect(rows[0]).toMatchObject({ type: "LEVEL_CHANGED", tournamentId: null, payload });
  });

  it("stores the result id and the old and new status of a changed swim result", async () => {
    expectTypeOf<DomainEventMap["SWIM_RESULT_CHANGED"]>().branded.toEqualTypeOf<{
      tournamentId: string;
      teamId: string;
      resultId: string;
      swimId: string;
      userId: string;
      status: SwimResultStatus;
      previousStatus: SwimResultStatus | null;
    }>();
    const payload: DomainEventMap["SWIM_RESULT_CHANGED"] = {
      tournamentId: "t1",
      teamId: "team1",
      resultId: "r1",
      swimId: "s1",
      userId: "u1",
      status: "VERIFIED",
      previousStatus: null,
    };
    await db.$transaction((tx) => emitEvent(tx, { type: "SWIM_RESULT_CHANGED", payload }));

    const rows = await db.domainEvent.findMany();
    expect(rows[0]).toMatchObject({ type: "SWIM_RESULT_CHANGED", payload });
  });

  it("runs handlers of that type only, with the payload and the same transaction", async () => {
    const seen: unknown[] = [];
    let rowVisible = 0;
    registerHandler("TEAM_PROGRESS_CHANGED", async (tx, payload) => {
      seen.push(payload);
      rowVisible = await tx.domainEvent.count();
    });
    registerHandler("TEAM_FINISHED", () => {
      seen.push("wrong");
    });

    await db.$transaction((tx) =>
      emitEvent(tx, { type: "TEAM_PROGRESS_CHANGED", payload: progress }),
    );

    expect(seen).toEqual([progress]);
    expect(rowVisible).toBe(1);
  });

  it("rolls back the caller's writes and the event when a handler throws", async () => {
    registerHandler("TEAM_FINISHED", () => {
      throw new Error("handler failed");
    });

    await expect(
      db.$transaction(async (tx) => {
        await tx.user.create({
          data: { email: "a@example.com", passwordHash: "h", displayName: "A" },
        });
        await emitEvent(tx, {
          type: "TEAM_FINISHED",
          payload: { tournamentId: "t1", teamId: "team1" },
        });
      }),
    ).rejects.toThrow("handler failed");

    expect(await db.user.count()).toBe(0);
    expect(await db.domainEvent.count()).toBe(0);
  });
});
