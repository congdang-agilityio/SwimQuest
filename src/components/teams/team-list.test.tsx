// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import vi_ from "../../../messages/vi/teams.json";
import routesVi from "../../../messages/vi/routes.json";
import { TeamList } from "./team-list";
import { browser } from "@/lib/http/client-fetch";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

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

describe("TeamList links", () => {
  it("links each team to its organizer page", () => {
    setup(true);
    const link = screen.getByRole("link", { name: "Đội a" });
    expect(link.getAttribute("href")).toBe("/tournaments/t1/manage/teams/a");
  });
});

describe("TeamList start status (#158)", () => {
  it("shows each team's start and lock only when startLock is given", () => {
    const render_ = (startLock?: { locked: boolean; lockAtIso: string }) =>
      render(
        <NextIntlClientProvider locale="vi" messages={{ teams: vi_, routes: routesVi }}>
          <TeamList
            tournamentId="t1"
            teams={[
              { ...team("a", 1, 5), startNameKey: "routes.route01.son_thuy" },
              team("b", 0, 5),
            ]}
            capacity={10}
            isDraft={false}
            startLock={startLock}
          />
        </NextIntlClientProvider>,
      );
    render_();
    expect(screen.queryByText(/Chưa chọn điểm xuất phát/)).toBeNull();
    cleanup();
    render_({ locked: true, lockAtIso: "2099-11-01T06:00:00+07:00" });
    expect(screen.getByText(/Bãi Sơn Thủy/)).toBeTruthy();
    expect(screen.getByText("Chưa chọn điểm xuất phát")).toBeTruthy();
    expect(screen.getAllByText(/Đã khóa từ 06:00 01\/11\/2099/)).toHaveLength(2);
  });
});

describe("TeamList session expiry", () => {
  it("sends the player to log in again when deleting gets a 401, with no error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const go = vi.spyOn(browser, "go").mockImplementation(() => {});
    window.history.replaceState(null, "", "/tournaments/t1/manage");
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: vi_.manage.delete }));
    fireEvent.click(screen.getByRole("button", { name: vi_.manage.deleteConfirmYes }));
    await waitFor(() =>
      expect(go).toHaveBeenCalledWith("/login?next=%2Ftournaments%2Ft1%2Fmanage"),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
