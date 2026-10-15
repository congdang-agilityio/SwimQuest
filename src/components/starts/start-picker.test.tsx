// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import vi_ from "../../../messages/vi/starts.json";
import { StartPicker } from "./start-picker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const STARTS = ["non_nuoc", "son_thuy", "pham_van_dong", "man_thai", "hon_sup", "cu_lao_cham"];
const LOCK = "2098-10-31T23:00:00.000Z";
function setup(props: Partial<Parameters<typeof StartPicker>[0]> = {}) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ starts: vi_ }}>
      <StartPicker
        teamId="t1"
        starts={STARTS}
        finish="ly_son"
        currentSlug={null}
        routeDistanceKm={80.5}
        lockAtIso={LOCK}
        readOnly={false}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
const radio = (slug: keyof typeof vi_.names) =>
  screen.getByRole("radio", { name: new RegExp(vi_.names[slug]) }) as HTMLInputElement;
const confirm = () => fireEvent.click(screen.getByRole("button", { name: vi_.picker.confirm }));

describe("StartPicker", () => {
  it("lists six selectable starts with the same distance and Ly Son as a disabled finish", () => {
    setup();
    for (const slug of STARTS as (keyof typeof vi_.names)[]) {
      expect(radio(slug).disabled).toBe(false);
      expect(radio(slug).closest("label")!.textContent).toContain("80,5 km");
    }
    expect(radio("ly_son").disabled).toBe(true);
    expect(radio("ly_son").closest("label")!.textContent).toContain(vi_.picker.finish);
  });

  it("asks for a choice with an accessible error and does not call the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setup();
    confirm();
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(group.getAttribute("aria-describedby")!)?.textContent).toBe(
      vi_.picker.errors.NO_SELECTION,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves the pick with PUT and confirms with the lock date and time", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    setup({ currentSlug: "non_nuoc" });
    fireEvent.click(radio("hon_sup"));
    confirm();
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("06:00 01/11/2098"),
    );
    expect(screen.getByRole("status").textContent).toContain(vi_.names.hon_sup);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/teams/t1/start");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ destination: "hon_sup" });
  });

  it("shows the lock time on 409 START_LOCKED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: { code: "START_LOCKED", issues: [{ lockedAt: "2098-10-31T23:00:00.000Z" }] },
        }),
      }),
    );
    setup();
    fireEvent.click(radio("son_thuy"));
    confirm();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("06:00 01/11/2098"),
    );
  });

  it("is read-only for a member: start shown, nothing selectable, no confirm button", () => {
    setup({ readOnly: true, currentSlug: "man_thai" });
    expect(radio("man_thai").checked).toBe(true);
    expect(radio("son_thuy").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: vi_.picker.confirm })).toBeNull();
    expect(screen.getByText(vi_.picker.readOnly)).toBeTruthy();
  });
});
