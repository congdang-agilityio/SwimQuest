// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it } from "vitest";
import en from "../../../../messages/en/settings.json";
import { SwimRules } from "./swim-rules";

afterEach(cleanup);

it("describes the limits and swim type in plain words", () => {
  render(
    <NextIntlClientProvider locale="en" messages={{ settings: en }}>
      <SwimRules
        rules={{
          longestSwimCountedM: 10000,
          dailyLimitM: 2500,
          swimTypeAllowed: "OPEN_WATER_ONLY",
        }}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("At most 10 km of one swim counts.")).toBeTruthy();
  expect(screen.getByText("At most 2.5 km and its points count per player per day.")).toBeTruthy();
  expect(screen.getByText("Swim type that counts: Open water only.")).toBeTruthy();
});
