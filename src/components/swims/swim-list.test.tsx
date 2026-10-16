// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import statesVi from "../../../messages/vi/states.json";
import viMsgs from "../../../messages/vi/my-swims.json";
import { browser } from "@/lib/http/client-fetch";
import { SwimList } from "./swim-list";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const item = (id: string, startedAt: string, distanceM = 1250) => ({
  id,
  startedAt,
  distanceM,
  durationS: 1500,
});

function setup(items: ReturnType<typeof item>[], cursor: string | null) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ "my-swims": viMsgs, states: statesVi }}>
      <SwimList initialItems={items} initialCursor={cursor} />
    </NextIntlClientProvider>,
  );
}

describe("SwimList", () => {
  it("shows date, distance and duration, each row linking to the swim", () => {
    setup([item("a", "2026-06-01T07:05:00.000Z")], null);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/swims/a");
    expect(link.textContent).toContain("14:05 01/06/2026");
    expect(link.textContent).toContain("1,25 km");
    expect(link.textContent).toContain("25:00");
    expect(screen.queryByRole("button", { name: viMsgs.more })).toBeNull();
  });

  it("More appends older swims after the current ones and hides itself at the end", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [item("b", "2026-05-01T07:00:00.000Z")], nextCursor: null }),
    });
    vi.stubGlobal("fetch", fetchMock);
    setup([item("a", "2026-06-01T07:05:00.000Z")], "cur 1");
    fireEvent.click(screen.getByRole("button", { name: viMsgs.more }));
    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/me/swims?cursor=cur%201");
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/swims/a",
      "/swims/b",
    ]);
    expect(screen.queryByRole("button", { name: viMsgs.more })).toBeNull();
  });

  it("keeps the list and shows an error when More fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    setup([item("a", "2026-06-01T07:05:00.000Z")], "c");
    fireEvent.click(screen.getByRole("button", { name: viMsgs.more }));
    expect((await screen.findByRole("alert")).textContent).toContain(viMsgs.error);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("sends the player to log in again on 401 and shows no error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const go = vi.spyOn(browser, "go").mockImplementation(() => {});
    window.history.replaceState(null, "", "/swims?x=1");
    setup([item("a", "2026-06-01T07:05:00.000Z")], "c");
    fireEvent.click(screen.getByRole("button", { name: viMsgs.more }));
    await waitFor(() => expect(go).toHaveBeenCalledWith("/login?next=%2Fswims%3Fx%3D1"));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    window.history.replaceState(null, "", "/");
  });

  it("explains how to add a swim when the list is empty", () => {
    setup([], null);
    expect(screen.getByText(viMsgs.empty)).toBeTruthy();
    expect(screen.getByRole("link", { name: viMsgs.add }).getAttribute("href")).toBe("/connect");
  });
});
