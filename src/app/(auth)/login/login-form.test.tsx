// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en/auth.json";
import vi_ from "../../../../messages/vi/auth.json";
import { LogoutButton } from "@/components/auth/logout-button";
import { LoginForm } from "./login-form";

const getCurrentUser = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
);
vi.mock("@/server/auth/current-user", () => ({ getCurrentUser }));
vi.mock("next/navigation", () => ({ redirect }));

import LoginPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function setup(messages: typeof vi_ | typeof en = vi_, next?: string) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ auth: messages }}>
      <LoginForm next={next} />
    </NextIntlClientProvider>,
  );
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: vi_.login.submit }));

async function logInWith(status: number, next?: string) {
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status }));
  setup(vi_, next);
  fill(vi_.fields.email, "a@b.vn");
  fill(vi_.fields.password, "whatever-pass");
  submit();
  return assign;
}

describe("LoginForm", () => {
  it("shows the same generic message for a 401, whatever the cause", async () => {
    await logInWith(401);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(vi_.errors.INVALID_CREDENTIALS),
    );
    cleanup();
    await logInWith(401);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(vi_.errors.INVALID_CREDENTIALS),
    );
  });

  it("labels each empty field and does not call the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setup();
    submit();
    for (const [field, text] of [
      ["email", vi_.errors.EMAIL_REQUIRED],
      ["password", vi_.errors.PASSWORD_REQUIRED],
    ] as const) {
      const input = screen.getByLabelText(vi_.fields[field]);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
        text,
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("goes to a safe next path on 200 and to the home page / otherwise", async () => {
    const there = await logInWith(200, "/teams/3?x=1");
    await waitFor(() => expect(there).toHaveBeenCalledWith("/teams/3?x=1"));
    cleanup();
    const home = await logInWith(200);
    await waitFor(() => expect(home).toHaveBeenCalledWith("/"));
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com"])(
    "falls back to the home page / for the unsafe next %j",
    async (next) => {
      const assign = await logInWith(200, next);
      await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    },
  );

  it("links to /signup keeping a safe next only", () => {
    setup(vi_, "/teams/3?x=1");
    expect(screen.getByRole("link", { name: vi_.login.signupCta }).getAttribute("href")).toBe(
      "/signup?next=%2Fteams%2F3%3Fx%3D1",
    );
    cleanup();
    setup(vi_, "//evil.com");
    expect(screen.getByRole("link", { name: vi_.login.signupCta }).getAttribute("href")).toBe(
      "/signup",
    );
  });

  it("makes the signup link at least 44x44 CSS px", () => {
    setup();
    const a = screen.getByRole("link", { name: vi_.login.signupCta });
    expect([a.style.minHeight, a.style.minWidth]).toEqual(["44px", "44px"]);
  });
});

describe("LoginPage", () => {
  it("sends a signed-in user to the home page /", async () => {
    getCurrentUser.mockResolvedValue({ id: "u" });
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(/^REDIRECT \/$/);
  });

  it("passes next to the form for a signed-out visitor", async () => {
    getCurrentUser.mockResolvedValue(null);
    const page = await LoginPage({ searchParams: Promise.resolve({ next: "/teams/3" }) });
    expect(page.props.next).toBe("/teams/3");
    const many = await LoginPage({ searchParams: Promise.resolve({ next: ["/a", "/b"] }) });
    expect(many.props.next).toBeUndefined();
  });
});

describe("LogoutButton", () => {
  it("posts to the logout API then replaces the location with /login", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <NextIntlClientProvider locale="vi" messages={{ auth: vi_ }}>
        <LogoutButton />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: vi_.logout.button }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("stays put and shows an error when logout fails", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(
      <NextIntlClientProvider locale="vi" messages={{ auth: vi_ }}>
        <LogoutButton />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: vi_.logout.button }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(vi_.errors.GENERIC));
    expect(replace).not.toHaveBeenCalled();
  });
});
