// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/captain.json";
import { browser } from "@/lib/http/client-fetch";
import { MakeCaptainButton } from "./make-captain-button";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  refresh.mockClear();
  window.history.replaceState(null, "", "/");
});

function setup() {
  render(
    <NextIntlClientProvider locale="en" messages={{ captain: en }}>
      <MakeCaptainButton teamId="t1" userId="u1" name="An" />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Make An captain" }));
}

describe("MakeCaptainButton", () => {
  it("refreshes after a successful appointment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    setup();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows the error for other failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    setup();
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("sends the player to log in again on 401 and shows no error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const go = vi.spyOn(browser, "go").mockImplementation(() => {});
    window.history.replaceState(null, "", "/team");
    setup();
    await waitFor(() => expect(go).toHaveBeenCalledWith("/login?next=%2Fteam"));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});
