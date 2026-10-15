// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../../messages/en/join.json";

const state = vi.hoisted(() => ({ getJoinView: vi.fn() }));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: keyof typeof en) => en[key],
}));
vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({ id: "u1", displayName: "U", isPlatformAdmin: false }),
}));
vi.mock("@/server/join/join-view", () => ({ getJoinView: state.getJoinView }));
vi.mock("@/components/join/team-picker", () => ({
  TeamPicker: ({ myTeam }: { myTeam: { name: string } | null }) => (
    <div data-testid="picker">{myTeam ? `member of ${myTeam.name}` : "pick a team"}</div>
  ),
}));
vi.mock("@/components/tournaments/tournament-summary", () => ({
  TournamentSummary: ({ name }: { name: string }) => <div>{name}</div>,
}));

const { default: JoinPage } = await import("./page");

const tournament = {
  name: "Autumn Cup",
  description: null,
  seasonStartAt: new Date("2026-10-01"),
  seasonEndAt: new Date("2026-11-01"),
  routeId: "r1",
  routeDistanceM: 10000,
  eligibilityNotes: null,
};
const teams = [{ id: "a", name: "Turtles", emblemKey: "turtle", memberLimit: 5, memberCount: 2 }];

async function renderPage(token = "tok") {
  render(await JoinPage({ params: Promise.resolve({ token }) }));
}

describe("join page", () => {
  beforeEach(() => state.getJoinView.mockReset());
  afterEach(cleanup);

  it("shows the invalid-link state when the token matches no tournament", async () => {
    state.getJoinView.mockResolvedValue(null);
    await renderPage("not-a-real-token");
    expect(state.getJoinView).toHaveBeenCalledWith("u1", "not-a-real-token");
    expect(screen.getByRole("heading", { name: en.invalidTitle })).toBeTruthy();
    expect(screen.getByText(en.invalidBody)).toBeTruthy();
    expect(screen.queryByTestId("picker")).toBeNull();
    expect(screen.queryByText("Autumn Cup")).toBeNull();
  });

  it("shows the closed state and no picker when joining is closed for a non-member", async () => {
    state.getJoinView.mockResolvedValue({ tournament, teams, myTeam: null, joiningOpen: false });
    await renderPage();
    expect(screen.getByRole("status").textContent).toContain(en.closedTitle);
    expect(screen.getByRole("status").textContent).toContain(en.closedBody);
    expect(screen.queryByTestId("picker")).toBeNull();
    expect(screen.getByText("Autumn Cup")).toBeTruthy();
  });

  it("still shows a member their team when joining is closed", async () => {
    state.getJoinView.mockResolvedValue({
      tournament,
      teams,
      myTeam: { id: "a", name: "Turtles" },
      joiningOpen: false,
    });
    await renderPage();
    expect(screen.getByTestId("picker").textContent).toBe("member of Turtles");
    expect(screen.queryByText(en.closedTitle, { exact: false })).toBeNull();
  });

  it("shows the picker when joining is open", async () => {
    state.getJoinView.mockResolvedValue({ tournament, teams, myTeam: null, joiningOpen: true });
    await renderPage();
    expect(screen.getByTestId("picker").textContent).toBe("pick a team");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
