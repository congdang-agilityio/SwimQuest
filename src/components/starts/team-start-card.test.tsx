// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import routesEn from "../../../messages/en/routes.json";
import startsEn from "../../../messages/en/starts.json";
import routesVi from "../../../messages/vi/routes.json";
import startsVi from "../../../messages/vi/starts.json";
import { TeamStartCard } from "./team-start-card";

afterEach(cleanup);

// 06:00 on 01/11/2098 in Vietnam time.
const LOCK = "2098-10-31T23:00:00.000Z";
const KEY = "routes.route01.hon_sup";

function setup(props: Partial<Parameters<typeof TeamStartCard>[0]>, lang: "vi" | "en" = "vi") {
  const messages =
    lang === "vi" ? { starts: startsVi, routes: routesVi } : { starts: startsEn, routes: routesEn };
  render(
    <NextIntlClientProvider locale={lang} messages={messages}>
      <TeamStartCard startNameKey={null} isCaptain lockAtIso={LOCK} locked={false} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("TeamStartCard", () => {
  it("shows the captain a Choose start link, the deadline in Vietnam time and the automatic note", () => {
    setup({});
    expect(screen.getByText(startsVi.card.notChosen)).toBeTruthy();
    const link = screen.getByRole("link", { name: startsVi.card.choose });
    expect(link.getAttribute("href")).toBe("/team/start");
    expect(link.style.minHeight).toBe("44px");
    expect(screen.getByText(/06:00 01\/11\/2098/)).toBeTruthy();
    expect(screen.getByText(startsVi.card.auto)).toBeTruthy();
  });

  it("offers the captain a change link once a start is chosen, without the automatic note", () => {
    setup({ startNameKey: KEY });
    expect(screen.getByText(routesVi.route01.hon_sup)).toBeTruthy();
    expect(screen.getByRole("link", { name: startsVi.card.change })).toBeTruthy();
    expect(screen.queryByText(startsVi.card.auto)).toBeNull();
  });

  it("shows a member the start with no link", () => {
    setup({ isCaptain: false, startNameKey: KEY }, "en");
    expect(screen.getByText(routesEn.route01.hon_sup)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows a member not chosen yet with no link", () => {
    setup({ isCaptain: false });
    expect(screen.getByText(startsVi.card.notChosen)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the captain after the lock the start with no link", () => {
    setup({ locked: true, startNameKey: KEY });
    expect(screen.getByText(routesVi.route01.hon_sup)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(startsVi.card.auto)).toBeNull();
    expect(screen.getByText(/Đã khóa từ 06:00 01\/11\/2098/)).toBeTruthy();
  });

  it("shows no lock note before the lock", () => {
    setup({ startNameKey: KEY });
    expect(screen.queryByText(/Đã khóa từ/)).toBeNull();
  });
});
