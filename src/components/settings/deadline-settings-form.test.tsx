// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/settings.json";
import { DeadlineSettingsForm, type DeadlineSettingsValues } from "./deadline-settings-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const defaults: DeadlineSettingsValues = {
  submissionDays: 7,
  lateUploadDays: 3,
  startChoiceDeadlineAt: null,
  seasonStartAt: "2026-11-01T17:00:00.000Z",
};
function setup(values = defaults, locked = false) {
  render(
    <NextIntlClientProvider locale="en" messages={{ settings: en }}>
      <DeadlineSettingsForm tournamentId="t1" values={values} locked={locked} />
    </NextIntlClientProvider>,
  );
}
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const input = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe("DeadlineSettingsForm", () => {
  it("shows the defaults and that an empty deadline means the season start", () => {
    setup();
    expect(input(/Days to upload a swim/).value).toBe("7");
    expect(input(/after the season ends/).value).toBe("3");
    expect(input(/deadline: date/).value).toBe("");
    expect(input(/deadline: time/).value).toBe("");
    expect(screen.getByText(/season start \(00:00 02\/11\/2026\)/)).toBeTruthy();
  });

  it("shows a stored deadline as Vietnam date and time", () => {
    setup({ ...defaults, startChoiceDeadlineAt: "2026-10-30T13:30:00.000Z" });
    expect(input(/deadline: date/).value).toBe("2026-10-30");
    expect(input(/deadline: time/).value).toBe("20:30");
  });

  it("saves changed values and can go back to the season start", async () => {
    const fetchMock = vi.fn(() => json(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    setup({ ...defaults, startChoiceDeadlineAt: "2026-10-30T13:30:00.000Z" });
    fireEvent.change(input(/Days to upload a swim/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: en.deadlines.atSeasonStart }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Settings saved.")).toBeTruthy();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      group: "deadlines",
      values: {
        submissionDays: "5",
        lateUploadDays: "3",
        startChoiceDeadlineDate: "",
        startChoiceDeadlineTime: "",
      },
    });
  });

  it("shows field errors from a 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        json(400, {
          error: {
            code: "VALIDATION_FAILED",
            fields: { startChoiceDeadlineDate: "DEADLINE_AFTER_SEASON_START" },
          },
        }),
      ),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "cannot be after the season start",
    );
  });

  it("is read-only with the locked note when the season has started", () => {
    setup(defaults, true);
    expect(input(/Days to upload a swim/).disabled).toBe(true);
    expect(input(/deadline: date/).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.getByText(en.deadlines.locked)).toBeTruthy();
  });

  it("locks after a 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json(409, {})),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(en.deadlines.locked)).toBeTruthy();
    expect(input(/Days to upload a swim/).disabled).toBe(true);
  });
});
