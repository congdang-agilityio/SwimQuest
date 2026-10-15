// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import vi_ from "../../../messages/vi/teams.json";
import { TeamList } from "./team-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const team = (id: string, memberCount: number, memberLimit: number) => ({
  id,
  name: `Đội ${id}`,
  emblemKey: "turtle",
  description: null,
  memberLimit,
  memberCount,
});

function setup(isDraft: boolean) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ teams: vi_ }}>
      <TeamList
        tournamentId="t1"
        teams={[team("a", 0, 5), team("b", 2, 10)]}
        capacity={15}
        isDraft={isDraft}
      />
    </NextIntlClientProvider>,
  );
}

describe("TeamList", () => {
  it("shows members / limit and the capacity", () => {
    setup(true);
    expect(screen.getByText("0 / 5")).toBeTruthy();
    expect(screen.getByText("2 / 10")).toBeTruthy();
    expect(screen.getByText("Sức chứa: 15 chỗ")).toBeTruthy();
  });

  it("offers delete only for empty teams of a draft, with a confirmation", () => {
    setup(true);
    expect(screen.getAllByRole("button", { name: vi_.manage.delete })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: vi_.manage.delete }));
    expect(screen.getByText(/Xóa đội "Đội a"/)).toBeTruthy();
    expect(screen.getByRole("button", { name: vi_.manage.deleteConfirmYes })).toBeTruthy();
  });

  it("offers no delete once the tournament is no longer a draft", () => {
    setup(false);
    expect(screen.queryByRole("button", { name: vi_.manage.delete })).toBeNull();
  });

  it("opens the add form and the edit form with current values", () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: vi_.manage.add }));
    expect(screen.getByRole("form", { name: vi_.form.addTitle })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: vi_.manage.edit })[1]);
    expect((screen.getByLabelText(vi_.form.memberLimit) as HTMLInputElement).value).toBe("10");
  });
});
