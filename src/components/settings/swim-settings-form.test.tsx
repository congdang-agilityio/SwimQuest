// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/settings.json";
import { SwimSettingsForm } from "./swim-settings-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const defaults = {
  longestSwimCountedM: 10000,
  dailyLimitM: 10000,
  swimTypeAllowed: "ANY",
} as const;
function setup(locked = false) {
  render(
    <NextIntlClientProvider locale="en" messages={{ settings: en }}>
      <SwimSettingsForm tournamentId="t1" values={defaults} locked={locked} />
    </NextIntlClientProvider>,
  );
}
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("SwimSettingsForm", () => {
  it("shows the defaults with explanations", () => {
    setup();
    expect((screen.getByLabelText(/Longest swim counted/) as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText(/Daily limit/) as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText(/Swim type/) as HTMLSelectElement).selectedOptions[0].text).toBe(
      "Pool and open water",
    );
    expect(screen.getByText(/separate from the longest realistic swim/)).toBeTruthy();
    expect(screen.getByText(/per player per day/)).toBeTruthy();
  });

  it("saves the typed values and shows success", async () => {
    const fetchMock = vi.fn(() => json(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fireEvent.change(screen.getByLabelText(/Daily limit/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Settings saved.")).toBeTruthy();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      group: "swim",
      values: { longestSwimCountedKm: "10", dailyLimitKm: "5", swimTypeAllowed: "ANY" },
    });
  });

  it("shows field errors from a 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        json(400, {
          error: { code: "VALIDATION_FAILED", fields: { dailyLimitKm: "DISTANCE_NOT_POSITIVE" } },
        }),
      ),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "The distance must be greater than 0.",
    );
  });

  it("is read-only with a note when locked", () => {
    setup(true);
    expect(screen.getByText(/Locked for the season/)).toBeTruthy();
    expect((screen.getByLabelText(/Daily limit/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("switches to locked when the API answers 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json(409, { error: { code: "SEASON_LOCKED" } })),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText(/Locked for the season/)).toBeTruthy());
  });
});
