import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  const m = manifest();
  it("is an installable standalone app", () => {
    expect(m.name).toBe("SwimQuest");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
  });
  it("uses palette colours", () => {
    expect(m.theme_color).toBe("#062B46");
    expect(m.background_color).toBe("#F4FBFF");
  });
  it("lists the 192 and 512 icons", () => {
    expect(m.icons?.map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
    expect(m.icons?.map((i) => i.src)).toEqual(["/icons/icon-192.png", "/icons/icon-512.png"]);
  });
});
