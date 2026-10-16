// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en/swims.json";
import enChecks from "../../../messages/en/checks.json";
import enMy from "../../../messages/en/my-swims.json";
import type { MySwimDto } from "@/server/swims/my-swims";
import { SwimDetail } from "./swim-detail";

afterEach(cleanup);

const rules = {
  seasonStartAt: "2026-05-31T23:00:00.000Z",
  seasonEndAt: "2026-08-31T16:59:00.000Z",
  fastestPaceS: 65,
  slowestPaceS: 300,
  longestSwimM: 30000,
};
const swim: MySwimDto = {
  id: "s1",
  source: "GPX",
  startedAt: "2026-06-01T07:05:00.000Z",
  date: "2026-06-01",
  startTime: "14:05",
  distanceM: 1250,
  durationS: 1500,
  pacePer100mS: 120,
  swimType: "OPEN_WATER",
  isSwim: true,
  isDuplicate: false,
  results: [
    {
      tournamentId: "a",
      tournamentName: "Alpha",
      status: "VERIFIED",
      displayStatus: "verified",
      reasons: [],
      rules,
      points: { distance: 12, firstSwimBonus: 0, longSwimBonus: 0, total: 12 },
    },
    {
      tournamentId: "b",
      tournamentName: "Beta",
      status: "FLAGGED",
      displayStatus: "waitingForReview",
      reasons: ["PACE_TOO_FAST"],
      rules,
      points: { distance: 0, firstSwimBonus: 0, longSwimBonus: 0, total: 0 },
    },
  ],
};

function setup(over: Partial<MySwimDto> = {}) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ swims: en, checks: enChecks, "my-swims": enMy }}
    >
      <SwimDetail swim={{ ...swim, ...over }} />
    </NextIntlClientProvider>,
  );
}

describe("SwimDetail", () => {
  it("shows status, points and reasons for a swim verified in one tournament and flagged in another", () => {
    setup();
    const [alpha, beta] = screen
      .getAllByRole("listitem")
      .filter((li) => li.querySelector("strong"));
    expect(alpha.textContent).toContain("Alpha");
    expect(alpha.textContent).toContain("Verified");
    expect(alpha.textContent).toContain("Points earned here: 12");
    expect(beta.textContent).toContain("Flagged - waiting for review");
    expect(beta.textContent).toContain("Points earned here: 0");
    expect(beta.textContent).toMatch(/fastest realistic pace \(1:05 \/ 100 m\)/);
    expect(screen.getByText("1.25 km")).toBeTruthy();
  });
  it("lists distance points and each bonus on its own line, and only distance when no bonus", () => {
    setup({
      results: [
        {
          ...swim.results[0],
          points: { distance: 32, firstSwimBonus: 20, longSwimBonus: 25, total: 77 },
        },
        swim.results[0],
      ],
    });
    const [full, plain] = screen
      .getAllByRole("listitem")
      .filter((li) => li.querySelector("strong"));
    expect(full.textContent).toContain("Distance points: 32");
    expect(full.textContent).toContain("First-swim bonus: +20");
    expect(full.textContent).toContain("Long-swim bonus: +25");
    expect(full.textContent).toContain("Points earned here: 77");
    expect(plain.textContent).toContain("Distance points: 12");
    expect(plain.textContent).not.toContain("bonus");
  });
  it("has no swim-level status row", () => {
    setup();
    expect(screen.queryByText("Status")).toBeNull();
  });
  it("says so when the swim counts in no tournament", () => {
    setup({ results: [] });
    expect(screen.getByText(/does not count in any tournament yet/)).toBeTruthy();
  });
});
