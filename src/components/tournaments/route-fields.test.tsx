// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en/routes.json";
import vi_ from "../../../messages/vi/routes.json";
import { RouteFields } from "./route-fields";

afterEach(cleanup);

function setup(
  errors?: { routeId?: string; routeDistanceKm?: string },
  locale: "vi" | "en" = "vi",
) {
  render(
    <NextIntlClientProvider locale={locale} messages={{ routes: locale === "vi" ? vi_ : en }}>
      <RouteFields value="route01" onChange={() => {}} errors={errors} />
    </NextIntlClientProvider>,
  );
}

describe("RouteFields", () => {
  it("lists only Route 01 in the select", () => {
    setup();
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Lộ trình 01"]);
  });

  it("shows the seven destinations in order with Lý Sơn as the finish", () => {
    setup();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "Bãi biển Non Nước",
      "Bãi Sơn Thủy",
      "Bãi Phạm Văn Đồng",
      "Bãi Mân Thái",
      "Hòn Sụp",
      "Cù Lao Chàm",
      "Lý Sơn (điểm về đích)",
    ]);
  });

  it("has English destination names", () => {
    setup(undefined, "en");
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toBe("Non Nuoc Beach");
    expect(items[6]).toBe("Ly Son (finish)");
  });

  it("has an empty decimal distance field in km described by its hint", () => {
    setup();
    const input = screen.getByLabelText("Quãng đường lộ trình (km)") as HTMLInputElement;
    expect(input.name).toBe("routeDistanceKm");
    expect(input.value).toBe("");
    expect(input.getAttribute("inputmode")).toBe("decimal");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    const hint = document.getElementById(input.getAttribute("aria-describedby")!)!;
    expect(hint.textContent).toMatch(/cùng quãng đường/);
  });

  it("renders passed errors with role=alert and aria wiring", () => {
    setup({ routeId: "Chọn lộ trình", routeDistanceKm: "Quãng đường phải lớn hơn 0." });
    const input = screen.getByLabelText("Quãng đường lộ trình (km)");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("routeDistanceKm-error");
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
      "Chọn lộ trình",
      "Quãng đường phải lớn hơn 0.",
    ]);
    const select = screen.getByLabelText("Lộ trình");
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(select.getAttribute("aria-describedby")).toBe("routeId-error");
  });
});
