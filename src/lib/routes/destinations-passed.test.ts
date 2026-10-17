import { describe, expect, it } from "vitest";
import anchorsFile from "../../../public/art/route01/map-anchors.json";
import { destinationsPassed } from "./destinations-passed";

const anchors = anchorsFile.anchors;
const slugs = (from: number, to: number, start = "hon_sup") =>
  destinationsPassed("route01", anchors, start, from, to).map((d) => d.slug);

describe("destinationsPassed", () => {
  it("crosses Cu Lao Cham only once its anchor share of the path from Hon Sup is passed", () => {
    // Hon Sup -> Cu Lao Cham is about 35.6% of the path to Ly Son.
    expect(slugs(0, 2000)).toEqual([]);
    expect(slugs(0, 3500)).toEqual([]);
    expect(slugs(0, 3600)).toEqual(["cu_lao_cham"]);
    expect(slugs(3000, 9000)).toEqual(["cu_lao_cham"]);
  });

  it("does not cross it again after it was passed", () => {
    expect(slugs(3600, 9000)).toEqual([]);
  });

  it("never counts the start or the finish", () => {
    expect(slugs(0, 10000)).toEqual(["cu_lao_cham"]);
  });

  it("returns several destinations crossed in one step, in path order", () => {
    expect(slugs(0, 10000, "non_nuoc")).toEqual([
      "son_thuy",
      "pham_van_dong",
      "man_thai",
      "hon_sup",
      "cu_lao_cham",
    ]);
  });

  it("crosses nothing when progress does not grow or the start is unknown", () => {
    expect(slugs(8000, 3000)).toEqual([]);
    expect(slugs(3000, 3000)).toEqual([]);
    expect(slugs(0, 10000, "nowhere")).toEqual([]);
    expect(destinationsPassed("nope", anchors, "hon_sup", 0, 10000)).toEqual([]);
  });
});
