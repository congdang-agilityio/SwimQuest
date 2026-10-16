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
    fireEvent.click(screen.getByRole("button", { name: "Save deadlines" }));
    expect(await screen.findByText("Deadlines saved.")).toBeTruthy();
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

  it("shows field errors from a 400 linked to the date and time inputs", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Save deadlines" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("cannot be after the season start");
    for (const field of [input(/deadline: date/), input(/deadline: time/)]) {
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(field.getAttribute("aria-describedby")?.split(" ")).toEqual([
        "startChoiceDeadlineDate-help",
        alert.id,
      ]);
    }
    const days = input(/Days to upload a swim/);
    expect(days.getAttribute("aria-invalid")).toBeNull();
    expect(days.getAttribute("aria-describedby")).toBe("submissionDays-help");
  });

  it("links a days error to its input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        json(400, {
          error: { code: "VALIDATION_FAILED", fields: { submissionDays: "DAYS_INVALID" } },
        }),
      ),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save deadlines" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(en.deadlines.errors.DAYS_INVALID);
    const days = input(/Days to upload a swim/);
    expect(days.getAttribute("aria-invalid")).toBe("true");
    expect(days.getAttribute("aria-describedby")).toBe(`submissionDays-help ${alert.id}`);
    expect(input(/deadline: time/).getAttribute("aria-invalid")).toBeNull();
  });

  it("clears a stale deadline error on use the season start", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        json(400, {
          error: {
            code: "VALIDATION_FAILED",
            fields: { startChoiceDeadlineDate: "DEADLINE_INVALID" },
          },
        }),
      ),
    );
    setup({ ...defaults, startChoiceDeadlineAt: "2026-10-30T13:30:00.000Z" });
    fireEvent.click(screen.getByRole("button", { name: "Save deadlines" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: en.deadlines.atSeasonStart }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input(/deadline: date/).getAttribute("aria-invalid")).toBeNull();
    expect(input(/deadline: time/).getAttribute("aria-invalid")).toBeNull();
    expect(input(/deadline: date/).value).toBe("");
  });

  it("is read-only with the locked note when the season has started", () => {
    setup(defaults, true);
    expect(input(/Days to upload a swim/).disabled).toBe(true);
    expect(input(/deadline: date/).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save deadlines" })).toBeNull();
    expect(screen.getByText(en.deadlines.locked)).toBeTruthy();
  });

  it("locks after a 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json(409, {})),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save deadlines" }));
    expect(await screen.findByText(en.deadlines.locked)).toBeTruthy();
    expect(input(/Days to upload a swim/).disabled).toBe(true);
  });
});
