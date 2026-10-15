import { describe, expect, it } from "vitest";
import { getRoute, listRoutes, startDestinations } from "./index";

const SLUGS = [
  "non_nuoc",
  "son_thuy",
  "pham_van_dong",
  "man_thai",
  "hon_sup",
  "cu_lao_cham",
  "ly_son",
];

describe("route registry", () => {
  it("lists only Route 01", () => {
    expect(listRoutes().map((r) => r.id)).toEqual(["route01"]);
  });

  it("getRoute returns the route or null", () => {
    expect(getRoute("route01")?.id).toBe("route01");
    expect(getRoute("nope")).toBeNull();
    expect(getRoute("")).toBeNull();
    expect(getRoute("toString")).toBeNull();
  });

  it("has the seven destinations in order", () => {
    const route = getRoute("route01")!;
    expect(route.destinations.map((d) => d.slug)).toEqual(SLUGS);
  });

  it("uses message keys for names", () => {
    const route = getRoute("route01")!;
    for (const d of route.destinations) {
      expect(d.nameKey).toBe(`routes.route01.${d.slug}`);
    }
  });

  it("has exactly one finish, Ly Son", () => {
    const finishes = getRoute("route01")!.destinations.filter((d) => d.isFinish);
    expect(finishes.map((d) => d.slug)).toEqual(["ly_son"]);
  });

  it("startDestinations excludes the finish", () => {
    const starts = startDestinations(getRoute("route01")!);
    expect(starts.map((d) => d.slug)).toEqual(SLUGS.slice(0, 6));
  });
});
