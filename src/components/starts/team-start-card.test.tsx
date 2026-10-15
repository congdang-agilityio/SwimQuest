// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en/starts.json";
import vi_ from "../../../messages/vi/starts.json";
import { TeamStartCard } from "./team-start-card";

afterEach(cleanup);

// 2099-11-01 06:00 Vietnam time.
const LOCK = "2098-10-31T23:00:00.000Z";
function setup(props: Partial<Parameters<typeof TeamStartCard>[0]>, messages: object = vi_) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ starts: messages }}>
      <TeamStartCard startSlug={null} isCaptain lockAtIso={LOCK} locked={false} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("TeamStartCard", () => {
  it("shows the captain a Choose start link, the deadline in Vietnam time and the automatic note", () => {
    setup({});
    expect(screen.getByText(vi_.card.notChosen)).toBeTruthy();
    const link = screen.getByRole("link", { name: vi_.card.choose });
    expect(link.getAttribute("href")).toBe("/team/start");
    expect(link.style.minHeight).toBe("44px");
    expect(screen.getByText(/06:00 01\/11\/2098/)).toBeTruthy();
    expect(screen.getByText(vi_.card.auto)).toBeTruthy();
  });

  it("offers the captain a change link once a start is chosen, without the automatic note", () => {
    setup({ startSlug: "hon_sup" });
    expect(screen.getByText(vi_.names.hon_sup)).toBeTruthy();
    expect(screen.getByRole("link", { name: vi_.card.change })).toBeTruthy();
    expect(screen.queryByText(vi_.card.auto)).toBeNull();
  });

  it("shows a member the start or not chosen yet, with no link", () => {
    setup({ isCaptain: false, startSlug: "man_thai" }, en);
    expect(screen.getByText(en.names.man_thai)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    cleanup();
    setup({ isCaptain: false });
    expect(screen.getByText(vi_.card.notChosen)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hides the link for the captain after the lock", () => {
    setup({ locked: true, startSlug: "son_thuy" });
    expect(screen.getByText(vi_.names.son_thuy)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
