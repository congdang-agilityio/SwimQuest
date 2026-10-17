// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import routesEn from "../../../messages/en/routes.json";
import startsEn from "../../../messages/en/starts.json";
import voyageEn from "../../../messages/en/voyage.json";
import routesVi from "../../../messages/vi/routes.json";
import startsVi from "../../../messages/vi/starts.json";
import voyageVi from "../../../messages/vi/voyage.json";
import anchors from "../../../public/art/route01/map-anchors.json";
import { RouteMap, type RouteMapProps } from "./route-map";

afterEach(cleanup);

const slugs = Object.keys(anchors.anchors) as (keyof typeof anchors.anchors)[];
const destinations = slugs.map((slug) => ({
  slug,
  ...anchors.anchors[slug],
  isFinish: slug === "ly_son",
}));
const path = destinations.slice(2).map(({ x, y }) => ({ x, y }));

function setup(props: Partial<RouteMapProps>, lang: "en" | "vi" = "en") {
  const messages =
    lang === "en"
      ? { voyage: voyageEn, routes: routesEn, starts: startsEn }
      : { voyage: voyageVi, routes: routesVi, starts: startsVi };
  const full: RouteMapProps = {
    routeId: "route01",
    teamName: "Cá Mập",
    destinations,
    path,
    start: { slug: "pham_van_dong", automaticAtIso: null },
    progress: { progressBp: 6800, routeKmReached: 68, routeKmTotal: 100 },
    ship: { x: 50, y: 60 },
    ...props,
  };
  render(
    <NextIntlClientProvider locale={lang} messages={messages}>
      <RouteMap {...full} />
    </NextIntlClientProvider>,
  );
}

describe("RouteMap", () => {
  it("shows the progress label, ship, path, start and all seven destination names as text", () => {
    setup({});
    expect(screen.getByTestId("progress-label").textContent).toBe("68 / 100 route km · 68%");
    expect(screen.getByTestId("ship")).toBeTruthy();
    expect(screen.getByTestId("route-path")).toBeTruthy();
    for (const slug of slugs) {
      expect(screen.getByTestId(`destination-${slug}`).textContent).toContain(
        (routesEn.route01 as Record<string, string>)[slug],
      );
    }
    expect(screen.getByTestId("destination-ly_son").textContent).toContain("Finish");
    expect(screen.getByTestId("start-info").textContent).toContain("Pham Van Dong Beach");
    expect(screen.getByText(voyageEn.note)).toBeTruthy();
  });

  it("renders exactly one progress label, outside the ship, next to the map box", () => {
    setup({});
    expect(screen.getAllByTestId("progress-label")).toHaveLength(1);
    const label = screen.getByTestId("progress-label");
    expect(screen.getByTestId("ship").contains(label)).toBe(false);
    expect(screen.getByTestId("route-map").contains(label)).toBe(false);
    // In the band of the same frame as the map (the map sits in a sideways scroller on phones).
    expect(label.parentElement!.contains(screen.getByTestId("route-map"))).toBe(true);
  });

  it("places all seven destinations at their anchors", () => {
    setup({});
    expect(slugs).toHaveLength(7);
    for (const slug of slugs) {
      const el = screen.getByTestId(`destination-${slug}`);
      expect(el.style.left).toBe(`${anchors.anchors[slug].x}%`);
      expect(el.style.top).toBe(`${anchors.anchors[slug].y}%`);
    }
  });

  it("marks only Ly Son as the finish with a text marker", () => {
    setup({});
    expect(screen.getByTestId("destination-ly_son").textContent).toContain("(Finish)");
    expect(screen.getAllByTestId("finish-marker")).toHaveLength(1);
  });

  it("renders an 18:7 box, the aspect of the map art", () => {
    setup({});
    expect(screen.getByTestId("route-map").style.aspectRatio).toBe("18 / 7");
  });

  it("uses the current language", () => {
    setup({}, "vi");
    expect(screen.getByTestId("progress-label").textContent).toBe("68 / 100 km hành trình · 68%");
    expect(screen.getByTestId("destination-hon_sup").textContent).toContain("Hòn Sụp");
    expect(screen.getByText(voyageVi.note)).toBeTruthy();
  });

  it("keeps 100% with the ship at the finish", () => {
    setup({
      progress: { progressBp: 10000, routeKmReached: 100, routeKmTotal: 100 },
      ship: { x: 80, y: 79 },
    });
    expect(screen.getByTestId("progress-label").textContent).toBe("100 / 100 route km · 100%");
    expect(screen.getByTestId("ship").style.left).toBe("80%");
    expect(screen.getByTestId("ship").style.top).toBe("79%");
  });

  it("marks an automatic start with its assignment time", () => {
    setup({ start: { slug: "hon_sup", automaticAtIso: "2026-10-20T00:00:00.000Z" } });
    expect(screen.getByTestId("start-info").textContent).toContain("Assigned automatically");
  });

  it("without a start shows the notice and no path or ship, but still the note", () => {
    setup({ start: null, path: null, ship: null });
    expect(screen.getByTestId("no-start").textContent).toBe("Start not chosen yet");
    expect(screen.queryByTestId("route-path")).toBeNull();
    expect(screen.queryByTestId("ship")).toBeNull();
    expect(screen.queryByTestId("progress-label")).toBeNull();
    expect(screen.getByText(voyageEn.note)).toBeTruthy();
  });
});
