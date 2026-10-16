// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { browser, clientFetch } from "./client-fetch";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("clientFetch", () => {
  it.each([200, 201, 400, 403, 422, 500])("returns a %i response unchanged", async (status) => {
    const res = new Response(null, { status });
    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal("fetch", fetchMock);
    const go = vi.spyOn(browser, "go").mockImplementation(() => {});
    const init = { method: "POST" };
    await expect(clientFetch("/api/x", init)).resolves.toBe(res);
    expect(fetchMock).toHaveBeenCalledWith("/api/x", init);
    expect(go).not.toHaveBeenCalled();
  });

  it("sends the player to log in again on 401 and never settles", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const go = vi.spyOn(browser, "go").mockImplementation(() => {});
    window.history.replaceState(null, "", "/a/b?x=1");
    let settled = false;
    clientFetch("/api/x").then(
      () => (settled = true),
      () => (settled = true),
    );
    await vi.waitFor(() => expect(go).toHaveBeenCalledWith("/login?next=%2Fa%2Fb%3Fx%3D1"));
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
  });

  it("rejects on a network error like fetch", async () => {
    const err = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
    const go = vi.spyOn(browser, "go").mockImplementation(() => {});
    await expect(clientFetch("/api/x")).rejects.toBe(err);
    expect(go).not.toHaveBeenCalled();
  });
});
