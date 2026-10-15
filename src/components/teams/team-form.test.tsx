// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/teams.json";
import vi_ from "../../../messages/vi/teams.json";
import { TeamForm } from "./team-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(locale: "vi" | "en" = "vi", initial?: Parameters<typeof TeamForm>[0]["initial"]) {
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={{ teams: locale === "vi" ? vi_ : en }}>
      <TeamForm
        action={{ method: initial ? "PATCH" : "POST", url: "/api/x" }}
        initial={initial}
        onSaved={onSaved}
        onCancel={() => {}}
      />
    </NextIntlClientProvider>,
  );
  return onSaved;
}
const submit = () => fireEvent.click(screen.getByRole("button", { name: /Lưu đội|Save team/ }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("TeamForm", () => {
  it("offers the six emblems and shows field errors with aria when empty", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setup();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    submit();
    const name = screen.getByLabelText(vi_.form.name);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(name.getAttribute("aria-describedby")).toBe("team-name-error");
    expect(screen.getByText(vi_.errors.NAME_REQUIRED)).toBeTruthy();
    expect(screen.getByText(vi_.errors.EMBLEM_INVALID)).toBeTruthy();
    expect(screen.getByText(vi_.errors.LIMIT_INVALID)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a limit of at least 1", () => {
    vi.stubGlobal("fetch", vi.fn());
    setup();
    type(vi_.form.name, "Cá heo");
    type(vi_.form.memberLimit, "0");
    submit();
    expect(screen.getByText(vi_.errors.LIMIT_INVALID)).toBeTruthy();
  });

  it("sends memberLimit as a JSON number and reports success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    const onSaved = setup();
    type(vi_.form.name, "Cá heo");
    fireEvent.click(screen.getByRole("radio", { name: vi_.emblems.dolphin }));
    type(vi_.form.memberLimit, "8");
    submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/x");
    expect(JSON.parse(init.body)).toEqual({
      name: "Cá heo",
      emblemKey: "dolphin",
      description: null,
      memberLimit: 8,
    });
  });

  it("shows the server's limit-below-members error at the limit field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: "LIMIT_BELOW_MEMBERS" } }),
      }),
    );
    setup("en", { name: "Turtles", emblemKey: "turtle", description: "", memberLimit: 5 });
    expect((screen.getByLabelText(en.form.name) as HTMLInputElement).value).toBe("Turtles");
    type(en.form.memberLimit, "1");
    submit();
    const msg = await screen.findByText(en.errors.LIMIT_BELOW_MEMBERS);
    expect(msg.id).toBe("team-memberLimit-error");
    expect(screen.getByLabelText(en.form.memberLimit).getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps vi and en keys identical", () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" ? keys(v).map((s) => `${k}.${s}`) : [k],
      );
    expect(keys(vi_)).toEqual(keys(en));
  });
});
