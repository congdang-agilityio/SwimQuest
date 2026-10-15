// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import routes from "../../../messages/vi/routes.json";
import teams from "../../../messages/vi/teams.json";
import { TeamStartStatus } from "./team-start-status";

afterEach(cleanup);

function setup(startNameKey: string | null, locked: boolean) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ teams, routes }}>
      <TeamStartStatus
        startNameKey={startNameKey}
        locked={locked}
        lockAtIso="2099-11-01T06:00:00+07:00"
      />
    </NextIntlClientProvider>,
  );
}

describe("TeamStartStatus", () => {
  it("says the start is not chosen yet", () => {
    setup(null, false);
    expect(screen.getByText("Chưa chọn điểm xuất phát")).toBeTruthy();
    expect(screen.queryByText(/Đã khóa/)).toBeNull();
  });

  it("shows the chosen start without a lock", () => {
    setup("routes.route01.son_thuy", false);
    expect(screen.getByText(/Bãi Sơn Thủy/)).toBeTruthy();
    expect(screen.queryByText(/Đã khóa/)).toBeNull();
  });

  it("shows Locked with the lock time once locked", () => {
    setup("routes.route01.son_thuy", true);
    expect(screen.getByText("Đã khóa từ 06:00 01/11/2099 (giờ Việt Nam)")).toBeTruthy();
  });
});
