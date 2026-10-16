// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../../../messages/en/organizer.json";

const state = vi.hoisted(() => ({ headers: new Headers(), tournament: {} as object }));

vi.mock("next/headers", () => ({ headers: async () => state.headers }));
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
vi.mock("@/server/auth/roles", () => ({
  ForbiddenError: class extends Error {},
  NotFoundError: class extends Error {},
  requireOrganizer: async () => state.tournament,
}));
vi.mock("@/server/teams/manage", () => ({
  listTeamsWithCounts: async () => ({ teams: [], capacity: 5 }),
}));
vi.mock("@/components/teams/team-list", () => ({ TeamList: () => <div>teams</div> }));
vi.mock("@/components/tournaments/invite-link", () => ({
  InviteLink: ({ url }: { url: string }) => <div data-testid="invite">{url}</div>,
}));

vi.mock("@/components/tournaments/publish-panel", () => ({
  PublishPanel: () => <div data-testid="publish-panel" />,
}));

const { default: ManagePage } = await import("./page");

function published(status = "PUBLISHED") {
  return {
    id: "t1",
    name: "Autumn Cup",
    status,
    inviteToken: "tok",
    seasonStartAt: new Date("2099-10-01T00:00:00Z"),
    seasonEndAt: new Date("2099-11-01T00:00:00Z"),
  };
}

async function renderPage() {
  render(await ManagePage({ params: Promise.resolve({ id: "t1" }) }));
}

describe("organizer manage page invite link origin", () => {
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    state.headers = new Headers({ host: "localhost:4100", "x-forwarded-proto": "https" });
    state.tournament = published();
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    error.mockRestore();
  });

  it("renders without the invite link and logs in production without APP_URL (#573)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    await renderPage();
    expect(screen.getByText(en.manage.statusNames.PUBLISHED)).toBeTruthy();
    expect(screen.queryByTestId("invite")).toBeNull();
    expect(document.body.innerHTML).not.toContain("/join/");
    expect(error).toHaveBeenCalledWith("APP_URL is not set: the public origin is unknown.");
  });

  it("builds the link from the Host header and x-forwarded-proto in test without APP_URL", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_URL", "");
    await renderPage();
    expect(screen.getByTestId("invite").textContent).toBe("https://localhost:4100/join/tok");
  });

  it("uses a valid APP_URL over the request headers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://swim.example/some/path");
    await renderPage();
    expect(screen.getByTestId("invite").textContent).toBe("https://swim.example/join/tok");
  });

  it("does not resolve the origin for a draft tournament", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    state.tournament = published("DRAFT");
    await renderPage();
    expect(screen.queryByTestId("invite")).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it("links to the Rules and settings page", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: en.manage.settingsLink }).getAttribute("href")).toBe(
      "/tournaments/t1/manage/settings",
    );
  });

  it("shows the publish panel for a draft only", async () => {
    state.tournament = published("DRAFT");
    await renderPage();
    expect(screen.getByTestId("publish-panel")).toBeTruthy();
    cleanup();
    state.tournament = published();
    await renderPage();
    expect(screen.queryByTestId("publish-panel")).toBeNull();
  });
});

describe("organizer manage page effective status (#158)", () => {
  afterEach(cleanup);

  it("shows Published before the season start and Active from it", async () => {
    state.headers = new Headers({ host: "localhost:4100" });
    state.tournament = published();
    await renderPage();
    expect(screen.getByText(en.manage.statusNames.PUBLISHED)).toBeTruthy();
    cleanup();
    state.tournament = {
      ...published(),
      seasonStartAt: new Date("2000-01-01T00:00:00Z"),
      seasonEndAt: new Date("2099-11-01T00:00:00Z"),
    };
    await renderPage();
    expect(screen.getByText(en.manage.statusNames.ACTIVE)).toBeTruthy();
  });
});
