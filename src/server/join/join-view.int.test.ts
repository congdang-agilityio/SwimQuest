import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  addMember,
  BEFORE_START,
  cleanJoinRows,
  SEASON_END,
  SEASON_START,
  tournamentWithTeams,
  user,
} from "./__tests__/fixtures";
import { getJoinView } from "./join-view";

describe("getJoinView", () => {
  beforeEach(cleanJoinRows);
  afterAll(async () => {
    await cleanJoinRows();
    await db.$disconnect();
  });

  it("returns the tournament summary and its teams with counts, limits and full flags", async () => {
    const { tournament, teams, token } = await tournamentWithTeams("PUBLISHED", [2, 1]);
    await addMember(teams[1].id, tournament.id, "m1");
    await addMember(teams[0].id, tournament.id, "left", "LEFT");
    const player = await user("player");

    const view = await getJoinView(player.id, token, BEFORE_START);

    expect(view).toEqual({
      tournament: {
        id: tournament.id,
        name: "Cup",
        description: "Swim around the bay",
        status: "PUBLISHED",
        seasonStartAt: SEASON_START,
        seasonEndAt: SEASON_END,
        eligibilityNotes: "Company staff",
        routeId: tournament.routeId,
        routeDistanceM: tournament.routeDistanceM,
      },
      teams: [
        {
          id: teams[0].id,
          name: "Team 0",
          emblemKey: "dolphin",
          description: null,
          memberCount: 0,
          memberLimit: 2,
          full: false,
        },
        {
          id: teams[1].id,
          name: "Team 1",
          emblemKey: "dolphin",
          description: null,
          memberCount: 1,
          memberLimit: 1,
          full: true,
        },
      ],
      myTeam: null,
      joiningOpen: true,
    });
  });

  it("shows the player's current team", async () => {
    const { tournament, teams, token } = await tournamentWithTeams();
    const player = await addMember(teams[0].id, tournament.id, "player");
    const view = await getJoinView(player.id, token, BEFORE_START);
    expect(view?.myTeam).toEqual({ id: teams[0].id, name: "Team 0", emblemKey: "dolphin" });
  });

  it("keeps joining open while active and closes it at the season end", async () => {
    const { token } = await tournamentWithTeams();
    const player = await user("player");
    const active = await getJoinView(player.id, token, SEASON_START);
    expect(active).toMatchObject({ joiningOpen: true, tournament: { status: "ACTIVE" } });
    expect(await getJoinView(player.id, token, SEASON_END)).toMatchObject({ joiningOpen: false });
  });

  it.each(["DRAFT", "COMPLETED"] as const)(
    "marks joining closed for a %s tournament",
    async (s) => {
      const { token } = await tournamentWithTeams(s);
      const player = await user("player");
      expect(await getJoinView(player.id, token, BEFORE_START)).toMatchObject({
        joiningOpen: false,
      });
    },
  );

  it.each([["unknown"], [""], [null], [42], ["x".repeat(500)]])(
    "returns null for an unknown or invalid token %#",
    async (token) => {
      await tournamentWithTeams();
      const player = await user("player");
      expect(await getJoinView(player.id, token, BEFORE_START)).toBeNull();
    },
  );
});
