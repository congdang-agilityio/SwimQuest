// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import routes from "../../../messages/vi/routes.json";
import vi_ from "../../../messages/vi/starts.json";
import { StartPicker } from "./start-picker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NAMES = routes.route01;
const SLUGS = [
  "non_nuoc",
  "son_thuy",
  "pham_van_dong",
  "man_thai",
  "hon_sup",
  "cu_lao_cham",
] as const;
const opt = (slug: string) => ({ slug, nameKey: `routes.route01.${slug}` });

function setup(props: Partial<Parameters<typeof StartPicker>[0]> = {}) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ starts: vi_, routes }}>
      <StartPicker
        teamId="team-1"
        starts={SLUGS.map(opt)}
        finish={opt("ly_son")}
        currentSlug={null}
        routeDistanceKm={80.5}
        lockAtIso="2099-11-01T06:00:00+07:00"
        readOnly={false}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
const radio = (slug: keyof typeof NAMES) =>
  screen.getByRole("radio", { name: new RegExp(NAMES[slug]) }) as HTMLInputElement;

describe("StartPicker", () => {
  it("lists six selectable starts with the same distance and Ly Son as a disabled finish", () => {
    setup();
    for (const slug of SLUGS) {
      expect(radio(slug).disabled).toBe(false);
      expect(radio(slug).closest("label")!.textContent).toContain("80,5 km");
    }
    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(radio("ly_son").disabled).toBe(true);
    expect(radio("ly_son").closest("label")!.textContent).toContain(vi_.picker.finish);
  });

  it("pre-selects the current start and lets the captain change it", () => {
    setup({ currentSlug: "son_thuy" });
    expect(radio("son_thuy").checked).toBe(true);
    fireEvent.click(radio("hon_sup"));
    expect(radio("hon_sup").checked).toBe(true);
    expect(radio("son_thuy").checked).toBe(false);
  });

  it("is read-only for a member: start shown, nothing selectable, note shown", () => {
    setup({ readOnly: true, currentSlug: "man_thai" });
    expect(radio("man_thai").checked).toBe(true);
    for (const slug of SLUGS) expect(radio(slug).disabled).toBe(true);
    expect(screen.getByText(vi_.picker.readOnly)).toBeTruthy();
  });

  it("when locked shows the lock time, no Confirm and nothing selectable", () => {
    setup({ readOnly: true, locked: true, currentSlug: "man_thai" });
    expect(screen.getByText(/đã khóa từ 06:00 01\/11\/2099/)).toBeTruthy();
    expect(screen.queryByText(vi_.picker.readOnly)).toBeNull();
    expect(screen.queryByRole("button", { name: vi_.picker.confirm })).toBeNull();
    for (const slug of SLUGS) expect(radio(slug).disabled).toBe(true);
  });

  it("keeps rows and the back link at least 44px high", () => {
    setup();
    for (const l of document.querySelectorAll("label"))
      expect(parseInt((l as HTMLElement).style.minHeight)).toBeGreaterThanOrEqual(44);
    expect(parseInt(screen.getByRole("link", { name: vi_.picker.back }).style.minHeight)).toBe(44);
  });

  describe("confirming", () => {
    const reply = (status: number, body: unknown) =>
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
    const confirm = () => fireEvent.click(screen.getByRole("button", { name: vi_.picker.confirm }));

    it("hides Confirm in read-only mode", () => {
      setup({ readOnly: true });
      expect(screen.queryByRole("button", { name: vi_.picker.confirm })).toBeNull();
    });

    it("shows a linked alert and sends no request when nothing is picked", () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      setup();
      confirm();
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe(vi_.picker.errors.NO_SELECTION);
      const group = screen.getByRole("group");
      expect(group.getAttribute("aria-invalid")).toBe("true");
      expect(group.getAttribute("aria-describedby")).toBe(alert.id);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("PUTs the slug and confirms with the start name and lock time", async () => {
      const fetchMock = reply(200, {});
      vi.stubGlobal("fetch", fetchMock);
      setup();
      fireEvent.click(radio("son_thuy"));
      confirm();
      const status = await screen.findByRole("status");
      expect(status.textContent).toContain(NAMES.son_thuy);
      expect(status.textContent).toContain("06:00 01/11/2099");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/teams/team-1/start");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ destination: "son_thuy" });
    });

    it("shows the lock time on 409 START_LOCKED", async () => {
      vi.stubGlobal(
        "fetch",
        reply(409, {
          error: { code: "START_LOCKED", issues: [{ lockedAt: "2099-11-01T06:00:00+07:00" }] },
        }),
      );
      setup({ currentSlug: "son_thuy" });
      confirm();
      expect((await screen.findByRole("alert")).textContent).toContain("06:00 01/11/2099");
    });

    it.each([
      ["INVALID_START", 422],
      ["FORBIDDEN", 403],
    ] as const)("shows the %s message", async (code, status) => {
      vi.stubGlobal("fetch", reply(status, { error: { code } }));
      setup({ currentSlug: "son_thuy" });
      confirm();
      expect((await screen.findByRole("alert")).textContent).toBe(vi_.picker.errors[code]);
    });

    it("shows the generic message for other failures and network errors", async () => {
      vi.stubGlobal("fetch", reply(500, {}));
      setup({ currentSlug: "son_thuy" });
      confirm();
      expect((await screen.findByRole("alert")).textContent).toBe(vi_.picker.errors.GENERIC);
      cleanup();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      setup({ currentSlug: "son_thuy" });
      confirm();
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toBe(vi_.picker.errors.GENERIC),
      );
    });
  });
});
