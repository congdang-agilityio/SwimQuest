// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import enPublish from "../../../messages/en/publish.json";
import enRoutes from "../../../messages/en/routes.json";
import viPublish from "../../../messages/vi/publish.json";
import viRoutes from "../../../messages/vi/routes.json";
import { TournamentSummary } from "./tournament-summary";

afterEach(cleanup);

function setup(locale: "vi" | "en" = "en") {
  const messages =
    locale === "en"
      ? { publish: enPublish, routes: enRoutes }
      : { publish: viPublish, routes: viRoutes };
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TournamentSummary
        name="Summer cup"
        description="Swim to Ly Son"
        // 2026-07-01 17:30 UTC = 2026-07-02 00:30 in Vietnam
        seasonStartAt="2026-07-01T17:30:00.000Z"
        seasonEndAt={new Date("2026-08-31T10:00:00.000Z")}
        routeId="route01"
        routeDistanceM={42500}
        teams={[
          { id: "a", name: "Dolphins", emblemKey: "unknown", freePlaces: 3 },
          { id: "b", name: "Sharks", emblemKey: "unknown", freePlaces: 1 },
          { id: "c", name: "Whales", emblemKey: "unknown", freePlaces: 0 },
        ]}
      />
    </NextIntlClientProvider>,
  );
}

describe("TournamentSummary", () => {
  it("shows name, description, route and distance in km", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Summer cup" })).toBeTruthy();
    expect(screen.getByText("Swim to Ly Son")).toBeTruthy();
    expect(screen.getByText(/Route 01, 42\.5 km/)).toBeTruthy();
  });

  it("formats season start and end in Vietnam time", () => {
    setup();
    expect(screen.getByText(/Starts: 00:30 2026-07-02/)).toBeTruthy();
    expect(screen.getByText(/Ends: 17:00 2026-08-31 \(Vietnam time, UTC\+7\)/)).toBeTruthy();
  });

  it("shows free places and marks a full team", () => {
    setup();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("3 places left");
    expect(items[1]).toContain("1 place left");
    expect(items[2]).toContain("full");
    expect(items[2]).not.toContain("places left");
  });

  it("renders Vietnamese by default copy", () => {
    setup("vi");
    expect(screen.getByText("Còn 3 chỗ", { exact: false })).toBeTruthy();
    expect(screen.getByText(/đã đầy/)).toBeTruthy();
  });
});
