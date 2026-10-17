import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ headers: new Headers(), requireUser: vi.fn() }));

vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: state.requireUser }));
vi.mock("@/components/nav/app-nav", () => ({ AppNav: () => null }));
vi.mock("@/server/profile/my-avatar", () => ({
  getAvatarFields: async () => ({ avatarImageId: null, avatarDefaultKey: null }),
}));
vi.mock("@/server/home/selected-tournament", () => ({ getTournamentSwitcher: async () => null }));

const layout = await import("./layout");

describe("(app) layout", () => {
  beforeEach(() => {
    state.headers = new Headers();
    state.requireUser.mockReset();
    state.requireUser.mockResolvedValue({ id: "u1", displayName: "U", isPlatformAdmin: false });
  });

  it("is always rendered per request", () => {
    expect(layout.dynamic).toBe("force-dynamic");
  });

  it("validates the session with the original path from middleware", async () => {
    state.headers.set("x-sq-next-path", "/tournaments/1?tab=team");
    const children = <p>inside</p>;
    const tree = await layout.default({ children });
    expect(JSON.stringify(tree)).toContain("inside");
    expect(state.requireUser).toHaveBeenCalledWith("/tournaments/1?tab=team");
  });

  it("falls back to / when the path header is missing", async () => {
    await layout.default({ children: null });
    expect(state.requireUser).toHaveBeenCalledWith("/");
  });

  it("passes the user's name and admin flag to the navigation", async () => {
    state.requireUser.mockResolvedValue({
      id: "a",
      displayName: "Admin An",
      isPlatformAdmin: true,
    });
    const tree = await layout.default({ children: null });
    const nav = tree.props.children[0];
    expect(nav.props).toEqual({
      bell: expect.anything(),
      displayName: "Admin An",
      avatarSrc: null,
      isPlatformAdmin: true,
      switcher: null,
    });
  });

  it("does not render children when the session is invalid", async () => {
    state.requireUser.mockRejectedValue(new Error("REDIRECT:/login?next=%2F"));
    await expect(layout.default({ children: <p>secret</p> })).rejects.toThrow("REDIRECT");
  });
});
