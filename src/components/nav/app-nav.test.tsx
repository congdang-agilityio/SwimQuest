// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/nav.json";
import vi_ from "../../../messages/vi/nav.json";
import auth from "../../../messages/vi/auth.json";

const state = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));

import { AppNav } from "./app-nav";

afterEach(cleanup);

function setup(pathname: string, isPlatformAdmin = false) {
  state.pathname = pathname;
  render(
    <NextIntlClientProvider locale="vi" messages={{ nav: vi_, auth }}>
      <AppNav displayName="Lan" isPlatformAdmin={isPlatformAdmin} />
    </NextIntlClientProvider>,
  );
}

describe("AppNav", () => {
  it("shows the five destinations", () => {
    setup("/");
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/", "/tournaments", "/team", "/voyage", "/profile"]);
  });

  it("marks only the current tab with aria-current=page", () => {
    setup("/tournaments/42");
    const current = screen.getAllByRole("link").filter((a) => a.hasAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("aria-current")).toBe("page");
    expect(current[0].textContent).toBe("Giải đấu");
  });

  it("marks Home on / and nothing on an unrelated page", () => {
    setup("/");
    expect(screen.getByRole("link", { name: "Trang chủ" }).getAttribute("aria-current")).toBe(
      "page",
    );
    cleanup();
    setup("/swims");
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("hides the Admin entry from players", () => {
    setup("/");
    expect(screen.queryByRole("link", { name: "Quản trị" })).toBeNull();
  });

  it("shows the Admin entry to a platform admin", () => {
    setup("/");
    cleanup();
    setup("/", true);
    expect(screen.getByRole("link", { name: "Quản trị" }).getAttribute("href")).toBe("/admin");
  });

  it("puts the display name and logout in the account menu", () => {
    setup("/");
    expect(screen.getByText("Lan")).toBeTruthy();
    expect(screen.getByText(auth.logout.button)).toBeTruthy();
  });

  it("has the same keys in vi and en", () => {
    expect(Object.keys(vi_.items)).toEqual(Object.keys(en.items));
    expect(Object.keys(vi_.profile)).toEqual(Object.keys(en.profile));
  });
});
