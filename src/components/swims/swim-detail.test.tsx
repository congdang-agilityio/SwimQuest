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
      points: 12,
    },
    {
      tournamentId: "b",
      tournamentName: "Beta",
      status: "FLAGGED",
      displayStatus: "waitingForReview",
      reasons: ["PACE_TOO_FAST"],
      rules,
      points: 0,
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
  it("has no swim-level status row", () => {
    setup();
    expect(screen.queryByText("Status")).toBeNull();
  });
  it("says so when the swim counts in no tournament", () => {
    setup({ results: [] });
    expect(screen.getByText(/does not count in any tournament yet/)).toBeTruthy();
  });
});
