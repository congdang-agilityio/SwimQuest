// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en/auth.json";
import vi_ from "../../../../messages/vi/auth.json";
import { SignUpForm, safeNext } from "./signup-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(messages: object = vi_) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ auth: messages }}>
      <SignUpForm />
    </NextIntlClientProvider>,
  );
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: vi_.signup.submit }));

describe("SignUpForm validation", () => {
  it("blocks an empty submission and labels each field error", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setup();
    submit();
    for (const [field, text] of [
      ["email", vi_.errors.EMAIL_REQUIRED],
      ["password", vi_.errors.PASSWORD_REQUIRED],
      ["displayName", vi_.errors.DISPLAY_NAME_REQUIRED],
    ] as const) {
      const input = screen.getByLabelText(vi_.fields[field]);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      const id = input.getAttribute("aria-describedby")!;
      expect(document.getElementById(id)?.textContent).toBe(text);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email and a short password", () => {
    setup();
    fill(vi_.fields.email, "not-an-email");
    fill(vi_.fields.password, "short");
    fill(vi_.fields.displayName, "Lan");
    submit();
    expect(screen.getByText(vi_.errors.EMAIL_INVALID)).toBeTruthy();
    expect(screen.getByText(vi_.errors.PASSWORD_TOO_SHORT)).toBeTruthy();
    expect(screen.getByLabelText(vi_.fields.displayName).getAttribute("aria-invalid")).toBeNull();
  });

  it("uses new-password autocomplete and links to /login", () => {
    setup();
    expect(screen.getByLabelText(vi_.fields.password).getAttribute("autocomplete")).toBe(
      "new-password",
    );
    const links = screen.getAllByRole("link", { name: vi_.signup.loginCta });
    expect(links[0].getAttribute("href")).toBe("/login");
  });

  it("shows the cannot-use-this-email message with a login link on 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 409 }));
    setup(en);
    fill(en.fields.email, "a@b.vn");
    fill(en.fields.password, "password123");
    fill(en.fields.displayName, "Lan");
    fireEvent.click(screen.getByRole("button", { name: en.signup.submit }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(en.errors.EMAIL_TAKEN),
    );
    const link = within(screen.getByRole("alert")).getByRole("link", { name: en.signup.loginCta });
    expect(link.getAttribute("href")).toBe("/login");
  });
});

describe("safeNext", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNext("/teams/3?x=1")).toBe("/teams/3?x=1");
  });
  it.each([undefined, "", "home", "//evil.com", "/\\evil.com", "https://evil.com", "/a\nb"])(
    "falls back to /home for %j",
    (value) => expect(safeNext(value)).toBe("/home"),
  );
});
