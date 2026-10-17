// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import team from "../../../messages/vi/team.json";
import { TeamRoster } from "./team-roster";

afterEach(cleanup);

describe("TeamRoster", () => {
  it("lists every member with km and points and marks only the captain", () => {
    render(
      <NextIntlClientProvider locale="vi" messages={{ team }}>
        <TeamRoster
          members={[
            {
              id: "a",
              displayName: "Lan",
              avatarImageId: null,
              avatarDefaultKey: null,
              verifiedKm: 1.5,
              points: 15,
              isCaptain: true,
              level: 2,
            },
            {
              id: "b",
              displayName: "Minh",
              avatarImageId: null,
              avatarDefaultKey: null,
              verifiedKm: 0,
              points: 0,
              isCaptain: false,
              level: 1,
            },
          ]}
        />
      </NextIntlClientProvider>,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Lan");
    expect(rows[0].textContent).toContain("Đội trưởng");
    expect(rows[0].textContent).toContain("1.5 km");
    expect(rows[0].textContent).toContain("15 điểm");
    expect(rows[1].textContent).toContain("0 km");
    expect(rows[1].textContent).not.toContain("Đội trưởng");
  });
});
