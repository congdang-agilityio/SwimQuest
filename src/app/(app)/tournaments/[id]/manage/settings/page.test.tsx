// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../../../../messages/en/settings.json";

const state = vi.hoisted(() => ({
  tournament: {} as object,
  access: null as "forbidden" | "missing" | null,
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) =>
    key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], en),
}));
vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({ id: "u1", displayName: "U", isPlatformAdmin: false }),
}));
vi.mock("@/server/auth/roles", () => {
  class ForbiddenError extends Error {}
  class NotFoundError extends Error {}
  return {
    ForbiddenError,
    NotFoundError,
    requireOrganizer: async () => {
      if (state.access === "forbidden") throw new ForbiddenError("FORBIDDEN");
      if (state.access === "missing") throw new NotFoundError("NOT_FOUND");
      return state.tournament;
    },
  };
});
vi.mock("@/server/tournaments/update-settings", () => ({
  getSettings: async () => ({
    swim: { longestSwimCountedM: 10000, dailyLimitM: 10000, swimTypeAllowed: "ANY" },
  }),
}));

const { default: SettingsPage } = await import("./page");

const DAY = 86_400_000;
function tournament(status: string, startOffsetDays: number) {
  const start = Date.now() + startOffsetDays * DAY;
  return {
    id: "t1",
    status,
    seasonStartAt: new Date(start),
    seasonEndAt: new Date(start + 30 * DAY),
    startChoiceDeadlineAt: null,
  };
}

async function renderPage() {
  const page = await SettingsPage({ params: Promise.resolve({ id: "t1" }) });
  render(
    <NextIntlClientProvider locale="en" messages={{ settings: en }}>
      {page}
    </NextIntlClientProvider>,
  );
}

const dailyLimit = () => screen.getByLabelText(/Daily limit/) as HTMLInputElement;
const swimType = () => screen.getByLabelText(/Swim type/) as HTMLSelectElement;

describe("Rules and settings page", () => {
  beforeEach(() => {
    state.access = null;
    state.tournament = tournament("PUBLISHED", 7);
  });
  afterEach(cleanup);

  it("gives a non-organizer the not-found page", async () => {
    state.access = "forbidden";
    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });

  it("gives the not-found page for an unknown tournament", async () => {
    state.access = "missing";
    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });

  it.each([
    ["DRAFT", -7],
    ["PUBLISHED", 7],
  ])("is editable for a %s tournament before the season", async (status, offset) => {
    state.tournament = tournament(status, offset);
    await renderPage();
    expect(dailyLimit().disabled).toBe(false);
    expect(swimType().disabled).toBe(false);
    expect(screen.getByRole("button", { name: en.swim.save })).toBeTruthy();
    expect(screen.queryByText(en.swim.locked)).toBeNull();
  });

  it("is read-only with the locked note once the season has started", async () => {
    state.tournament = tournament("PUBLISHED", -1);
    await renderPage();
    expect(dailyLimit().disabled).toBe(true);
    expect(swimType().disabled).toBe(true);
    expect(screen.queryByRole("button", { name: en.swim.save })).toBeNull();
    expect(screen.getByText(en.swim.locked)).toBeTruthy();
  });
});
