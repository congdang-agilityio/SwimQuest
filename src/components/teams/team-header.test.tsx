// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import team from "../../../messages/vi/team.json";
import { TeamHeader } from "./team-header";

afterEach(cleanup);

describe("TeamHeader", () => {
  it("shows name, description, captain, progress, points, members and the Add swim link", () => {
    render(
      <NextIntlClientProvider locale="vi" messages={{ team }}>
        <TeamHeader
          team={{ name: "Rùa Biển", emblemKey: "turtle", description: "Đội rùa", memberLimit: 5 }}
          captainName="Lan"
          progressBp={1250}
          teamPoints={30}
          memberCount={2}
        >
          <p>start-card</p>
        </TeamHeader>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Rùa Biển/)).toBeTruthy();
    expect(screen.getByText("Đội rùa")).toBeTruthy();
    expect(screen.getByText("Đội trưởng: Lan")).toBeTruthy();
    expect(screen.getByText("start-card")).toBeTruthy();
    expect(screen.getByText("Tiến độ: 12%")).toBeTruthy();
    expect(screen.getByText("30 điểm")).toBeTruthy();
    expect(screen.getByText("Thành viên: 2 / 5")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm buổi bơi" }).getAttribute("href")).toBe(
      "/connect",
    );
  });
});
