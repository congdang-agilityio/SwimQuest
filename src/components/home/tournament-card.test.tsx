// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en/home.json";
import vi_ from "../../../messages/vi/home.json";
import type { MyTournament } from "@/server/home/my-tournaments";
import { TournamentCard } from "./tournament-card";

afterEach(cleanup);

const base: MyTournament = {
  id: "t1",
  name: "Giải Hè",
  effectiveStatus: "ACTIVE",
  seasonStartAt: new Date("2026-10-31T17:00:00Z"),
  seasonEndAt: new Date("2027-01-31T16:59:59Z"),
  isOrganizer: false,
  team: { id: "k1", name: "Cá Heo", emblemKey: "dolphin" },
  progressBp: 6849,
};

function setup(tournament: MyTournament, locale: "vi" | "en" = "vi") {
  render(
    <NextIntlClientProvider locale={locale} messages={{ home: locale === "vi" ? vi_ : en }}>
      <ul>
        <TournamentCard tournament={tournament} />
      </ul>
    </NextIntlClientProvider>,
  );
}

describe("TournamentCard", () => {
  it("shows name, team with emblem, status, progress and the Add swim link", () => {
    setup(base);
    expect(screen.getByRole("heading", { name: "Giải Hè" })).toBeTruthy();
    expect(screen.getByText("Đội: Cá Heo")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Biểu tượng đội Cá Heo" })).toBeTruthy();
    expect(screen.getByText("Đang diễn ra")).toBeTruthy();
    expect(screen.getByText("Tiến độ: 68.5%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm buổi bơi" }).getAttribute("href")).toBe(
      "/connect",
    );
  });

  it("says the start is not chosen when there is no progress", () => {
    setup({ ...base, effectiveStatus: "PUBLISHED", progressBp: null });
    expect(screen.getByText("Chưa chọn điểm xuất phát")).toBeTruthy();
    expect(screen.getByText("Đang mở đăng ký")).toBeTruthy();
  });

  it("shows 0% as progress when a start is chosen and no start-not-chosen text", () => {
    setup({ ...base, progressBp: 0 });
    expect(screen.getByText("Tiến độ: 0%")).toBeTruthy();
    expect(screen.queryByText("Chưa chọn điểm xuất phát")).toBeNull();
  });

  it("shows no progress text for a team that has not chosen a start", () => {
    setup({ ...base, progressBp: null });
    expect(screen.queryByText(/Tiến độ/)).toBeNull();
  });

  it("says nothing about progress or the start for a card without a team", () => {
    setup({ ...base, team: null, progressBp: null }, "en");
    expect(screen.getByText("You have no team in this tournament")).toBeTruthy();
    expect(screen.queryByText(/Progress:/)).toBeNull();
    expect(screen.queryByText("Start not chosen yet")).toBeNull();
  });

  it("handles an organizer without a team and has an English mirror", () => {
    setup({ ...base, team: null, progressBp: null, effectiveStatus: "DRAFT" }, "en");
    expect(screen.getByText("You have no team in this tournament")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add swim" })).toBeTruthy();
  });

  it("keeps vi and en keys identical", () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" ? keys(v).map((s) => `${k}.${s}`) : [k],
      );
    expect(keys(vi_)).toEqual(keys(en));
  });
});
