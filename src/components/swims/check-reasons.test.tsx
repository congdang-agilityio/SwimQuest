// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en/checks.json";
import vi from "../../../messages/vi/checks.json";
import { REASON_CODES } from "@/server/checks/reasons";
import { CheckReasons } from "./check-reasons";

afterEach(cleanup);

const rules = {
  seasonStartAt: "2026-10-31T23:00:00.000Z", // 01/11 06:00 Vietnam
  seasonEndAt: "2026-12-31T16:59:00.000Z",
  fastestPaceS: 65,
  slowestPaceS: 300,
  longestSwimM: 30000,
};

function setup(reasons: string[], locale: "vi" | "en" = "en") {
  render(
    <NextIntlClientProvider locale={locale} messages={{ checks: locale === "en" ? en : vi }}>
      <CheckReasons reasons={reasons} rules={rules} />
    </NextIntlClientProvider>,
  );
}

describe("CheckReasons", () => {
  it.each([
    ["NOT_A_SWIM", /not a swimming activity/],
    ["NO_DISTANCE", /no usable distance/],
    ["OUTSIDE_SEASON", /outside the season \(01\/11 06:00 to 31\/12 23:59\)/],
    ["PACE_TOO_FAST", /fastest realistic pace \(1:05 \/ 100 m\)/],
    ["PACE_TOO_SLOW", /slowest realistic pace \(5:00 \/ 100 m\)/],
    ["DISTANCE_TOO_LONG", /longest realistic swim \(30 km\)/],
    ["DUPLICATE_OF_EARLIER_SWIM", /overlapping, a swim you uploaded earlier/],
  ])("explains %s in plain words", (code, text) => {
    setup([code]);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it("has a message in both languages for every reason code", () => {
    for (const code of REASON_CODES) {
      expect(en.reasons).toHaveProperty(code);
      expect(vi.reasons).toHaveProperty(code);
    }
  });

  it("shows Vietnamese text and lists several reasons", () => {
    setup(["NOT_A_SWIM", "NO_DISTANCE"], "vi");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows nothing for no reasons and skips unknown codes", () => {
    setup([]);
    expect(screen.queryByRole("list")).toBeNull();
    cleanup();
    setup(["SOMETHING_NEW"]);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
