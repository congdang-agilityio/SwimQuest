// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en/swims.json";
import vi from "../../../messages/vi/swims.json";
import type { OwnerSwimDto } from "@/server/swims/swim-dto";
import { SwimSummary } from "./swim-summary";

afterEach(cleanup);

const swim: OwnerSwimDto = {
  id: "s1",
  source: "GPX",
  startedAt: "2026-06-01T07:05:00.000Z",
  date: "2026-06-01",
  startTime: "14:05",
  distanceM: 1250,
  durationS: 1500,
  pacePer100mS: 120,
  swimType: "OPEN_WATER",
  isSwim: true,
  isDuplicate: false,
  results: [],
};

function setup(over: Partial<OwnerSwimDto> = {}, locale: "vi" | "en" = "vi") {
  render(
    <NextIntlClientProvider locale={locale} messages={{ swims: locale === "vi" ? vi : en }}>
      <SwimSummary swim={{ ...swim, ...over }} />
    </NextIntlClientProvider>,
  );
}

describe("SwimSummary", () => {
  it("shows Vietnam date/time, km distance, duration, pace, type and status in Vietnamese", () => {
    setup();
    expect(screen.getByText("14:05 01/06/2026")).toBeTruthy();
    expect(screen.getByText("1,25 km")).toBeTruthy();
    expect(screen.getByText("25:00")).toBeTruthy();
    expect(screen.getByText("2:00 /100 m")).toBeTruthy();
    expect(screen.getByText("Bơi ngoài trời")).toBeTruthy();
    expect(screen.getByText("Đã lưu")).toBeTruthy();
  });
  it("shows metres below 1 km and English text", () => {
    setup({ distanceM: 800, swimType: "POOL" }, "en");
    expect(screen.getByText("800 m")).toBeTruthy();
    expect(screen.getByText("Pool")).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
  });
  it("shows a duplicate status", () => {
    setup({ isDuplicate: true });
    expect(screen.getByText("Trùng với buổi bơi đã tải lên")).toBeTruthy();
  });
});
