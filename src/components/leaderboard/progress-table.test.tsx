// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import leaderboardVi from "../../../messages/vi/leaderboard.json";
import { ProgressTable } from "./progress-table";

afterEach(cleanup);

const row = (teamId: string, name: string, progressBp: number, km: number, isMyTeam = false) => ({
  teamId,
  name,
  emblemKey: "turtle",
  progressBp,
  routeKmReached: km,
  isMyTeam,
});

function setup() {
  render(
    <NextIntlClientProvider locale="vi" messages={{ leaderboard: leaderboardVi }}>
      <ProgressTable
        rows={[
          row("a", "Alpha", 5000, 50),
          row("b", "Beta", 2500, 25, true),
          row("c", "Gamma", 0, 0),
        ]}
      />
    </NextIntlClientProvider>,
  );
}

describe("ProgressTable", () => {
  it("keeps the given order with rank, name, progress and km", () => {
    setup();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["1", "2", "3"]);
    expect(rows[0].textContent).toContain("Alpha");
    expect(rows[0].textContent).toContain("50 km");
    expect(rows[1].textContent).toContain("Beta");
    expect(rows[2].textContent).toContain("Gamma");
  });

  it("has column headers for screen readers", () => {
    setup();
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  });

  it("marks only my team with a text tag and a non-colour style", () => {
    setup();
    expect(screen.getAllByText(/Đội của bạn/)).toHaveLength(1);
    const mine = screen.getByTestId("leaderboard-row-b");
    expect(mine.textContent).toContain("Đội của bạn");
    expect(mine.getAttribute("aria-current")).toBe("true");
    expect(mine.style.fontWeight).toBe("700");
    expect(screen.getByTestId("leaderboard-row-a").getAttribute("aria-current")).toBeNull();
  });
});
