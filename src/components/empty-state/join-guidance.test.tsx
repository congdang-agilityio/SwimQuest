// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en/tabs.json";
import vi_ from "../../../messages/vi/tabs.json";
import { JoinGuidance } from "./join-guidance";

afterEach(cleanup);

function setup(locale: "vi" | "en") {
  render(
    <NextIntlClientProvider locale={locale} messages={{ tabs: locale === "vi" ? vi_ : en }}>
      <JoinGuidance />
    </NextIntlClientProvider>,
  );
}

describe("JoinGuidance", () => {
  it("explains how to join and links to Create tournament (vi)", () => {
    setup("vi");
    expect(screen.getByRole("heading", { name: "Bạn chưa tham gia giải đấu nào" })).toBeTruthy();
    expect(screen.getByText(/liên kết mời/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Tạo giải đấu" });
    expect(link.getAttribute("href")).toBe("/tournaments/new");
  });

  it("has an English mirror", () => {
    setup("en");
    expect(screen.getByText(/invite link/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create tournament" })).toBeTruthy();
  });

  it("keeps vi and en keys identical", () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" ? keys(v).map((s) => `${k}.${s}`) : [k],
      );
    expect(keys(vi_)).toEqual(keys(en));
  });
});
