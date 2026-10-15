import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ headers: new Headers(), requireUser: vi.fn() }));

vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: state.requireUser }));

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
    await expect(layout.default({ children })).resolves.toBe(children);
    expect(state.requireUser).toHaveBeenCalledWith("/tournaments/1?tab=team");
  });

  it("falls back to / when the path header is missing", async () => {
    await layout.default({ children: null });
    expect(state.requireUser).toHaveBeenCalledWith("/");
  });

  it("does not render children when the session is invalid", async () => {
    state.requireUser.mockRejectedValue(new Error("REDIRECT:/login?next=%2F"));
    await expect(layout.default({ children: <p>secret</p> })).rejects.toThrow("REDIRECT");
  });
});
