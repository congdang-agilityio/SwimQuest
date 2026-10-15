// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import routes from "../../../messages/vi/routes.json";
import vi_ from "../../../messages/vi/starts.json";
import { StartPicker } from "./start-picker";

afterEach(cleanup);

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
        starts={SLUGS.map(opt)}
        finish={opt("ly_son")}
        currentSlug={null}
        routeDistanceKm={80.5}
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

  it("keeps rows and the back link at least 44px high", () => {
    setup();
    for (const l of document.querySelectorAll("label"))
      expect(parseInt((l as HTMLElement).style.minHeight)).toBeGreaterThanOrEqual(44);
    expect(parseInt(screen.getByRole("link", { name: vi_.picker.back }).style.minHeight)).toBe(44);
  });
});
