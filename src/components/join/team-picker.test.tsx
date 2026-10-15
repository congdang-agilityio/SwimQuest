// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/join.json";
import { TeamPicker } from "./team-picker";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

const teams = [
  { id: "a", name: "Turtles", emblemKey: "turtle", freePlaces: 2 },
  { id: "b", name: "Dolphins", emblemKey: "dolphin", freePlaces: 0 },
];

function setup(
  myTeam: { id: string; name: string } | null = null,
  preselectedId: string | null = null,
) {
  render(
    <NextIntlClientProvider locale="en" messages={{ join: en }}>
      <TeamPicker token="tok" teams={teams} myTeam={myTeam} preselectedId={preselectedId} />
    </NextIntlClientProvider>,
  );
}

describe("TeamPicker", () => {
  it("disables a full team with text", () => {
    setup();
    const full = screen.getByRole("button", {
      name: "Full, cannot be chosen",
    }) as HTMLButtonElement;
    expect(full.disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Join Turtles" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("joins and goes to My Team", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Join Turtles" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/team"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/join/tok");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ teamId: "a" });
    const join = screen.getByRole("button", { name: "Join Turtles" }) as HTMLButtonElement;
    expect(join.disabled).toBe(true);
  });

  it("refreshes and explains when the team just filled up", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { code: "TEAM_FULL" } }), { status: 409 }),
        ),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Join Turtles" }));
    expect((await screen.findByRole("alert")).textContent).toBe(en.justFilled);
    expect(refresh).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the current team without join buttons when already a member", () => {
    setup({ id: "a", name: "Turtles" });
    expect(screen.getByText("You are in Turtles")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to My Team" }).getAttribute("href")).toBe("/team");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("marks the team from the link as selected and joins it on one click", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setup(null, "a");
    expect(screen.getByText("Selected")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Join Turtles" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/team"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ teamId: "a" });
  });

  it("says the linked team is full and still lets the player choose another", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setup(null, "b");
    expect(screen.getByRole("status").textContent).toContain("Dolphins");
    expect(screen.queryByText("Selected")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Join Turtles" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/team"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ teamId: "a" });
  });

  it("lets the player change the choice after a failed join", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    setup(null, "a");
    fireEvent.click(screen.getByRole("button", { name: "Join Turtles" }));
    expect((await screen.findByRole("alert")).textContent).toBe(en.failed);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
