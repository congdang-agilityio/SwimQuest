// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/states.json";
import vi_ from "../../../messages/vi/states.json";
import { AccessDenied } from "./access-denied";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";

afterEach(cleanup);

function wrap(ui: ReactNode, locale: "vi" | "en" = "en") {
  render(
    <NextIntlClientProvider locale={locale} messages={{ states: locale === "vi" ? vi_ : en }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("LoadingState", () => {
  it("is a status region with a localized label", () => {
    wrap(<LoadingState />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });
  it("is localized (vi)", () => {
    wrap(<LoadingState />, "vi");
    expect(screen.getByRole("status").textContent).toContain("Đang tải");
  });
});

describe("EmptyState", () => {
  it("shows the message and a next-step link", () => {
    wrap(
      <EmptyState message="No swims yet" action={{ label: "Add a swim", href: "/swims/new" }} />,
    );
    expect(screen.getByRole("heading", { name: "No swims yet" })).toBeTruthy();
    const link = screen.getByRole("link", { name: "Add a swim" });
    expect(link.getAttribute("href")).toBe("/swims/new");
  });
  it("supports a button action", () => {
    const onClick = vi.fn();
    wrap(<EmptyState message="Empty" action={{ label: "Do it", onClick }} />);
    fireEvent.click(screen.getByRole("button", { name: "Do it" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("renders without an action", () => {
    wrap(<EmptyState message="Empty" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("shows a plain message and calls onRetry", () => {
    const onRetry = vi.fn();
    wrap(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it("is localized (vi)", () => {
    wrap(<ErrorState onRetry={() => {}} />, "vi");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
  });
});

describe("AccessDenied", () => {
  it("links back to Home", () => {
    wrap(<AccessDenied />);
    expect(screen.getByRole("heading", { name: "You do not have access" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Home" }).getAttribute("href")).toBe("/");
  });
  it("is localized (vi)", () => {
    wrap(<AccessDenied />, "vi");
    expect(screen.getByRole("link", { name: "Về Trang chủ" })).toBeTruthy();
  });
});

describe("states messages", () => {
  it("keeps vi and en keys identical", () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" ? keys(v).map((s) => `${k}.${s}`) : [k],
      );
    expect(keys(vi_)).toEqual(keys(en));
  });
});
