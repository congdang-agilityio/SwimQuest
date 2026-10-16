// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../../messages/en/settings.json";
import { DeadlineRules } from "./deadline-rules";

afterEach(cleanup);
const seasonStartAt = new Date("2026-11-01T17:00:00Z"); // 00:00 02/11/2026 Vietnam time

function setup(rules: Partial<Parameters<typeof DeadlineRules>[0]["rules"]> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={{ settings: en }}>
      <DeadlineRules
        rules={{
          submissionDays: 7,
          lateUploadDays: 3,
          startChoiceDeadlineAt: null,
          seasonStartAt,
          ...rules,
        }}
      />
    </NextIntlClientProvider>,
  );
}

describe("DeadlineRules", () => {
  it("shows the defaults with the season start date and time", () => {
    setup();
    expect(
      screen.getByText(
        "A swim must be uploaded within 7 days of the swim date and no later than 3 days after the season end time.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("The start choice closes at the season start (00:00 02/11/2026)."),
    ).toBeTruthy();
  });

  it("shows changed N, M and start-choice deadline", () => {
    setup({
      submissionDays: 5,
      lateUploadDays: 1,
      startChoiceDeadlineAt: new Date("2026-10-30T13:30:00Z"),
    });
    expect(screen.getByText(/within 5 days.*no later than 1 days/)).toBeTruthy();
    expect(screen.getByText("The start choice closes at 20:30 30/10/2026.")).toBeTruthy();
  });
});
