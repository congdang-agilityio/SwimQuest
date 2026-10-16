// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import routesEn from "../../../messages/en/routes.json";
import voyageEn from "../../../messages/en/voyage.json";
import routesVi from "../../../messages/vi/routes.json";
import voyageVi from "../../../messages/vi/voyage.json";
import anchors from "../../../public/art/route01/map-anchors.json";
import { RouteMap } from "./route-map";

afterEach(cleanup);

const slugs = Object.keys(anchors.anchors) as (keyof typeof anchors.anchors)[];
const destinations = slugs.map((slug) => ({
  slug,
  ...anchors.anchors[slug],
  isFinish: slug === "ly_son",
}));

function setup(lang: "en" | "vi" = "en") {
  const messages =
    lang === "en" ? { voyage: voyageEn, routes: routesEn } : { voyage: voyageVi, routes: routesVi };
  render(
    <NextIntlClientProvider locale={lang} messages={messages}>
      <RouteMap routeId="route01" destinations={destinations} />
    </NextIntlClientProvider>,
  );
}

describe("RouteMap", () => {
  it("shows all seven destination names as text in English, placed at the anchors", () => {
    setup("en");
    expect(slugs).toHaveLength(7);
    for (const slug of slugs) {
      const el = screen.getByTestId(`destination-${slug}`);
      expect(el.textContent).toContain((routesEn.route01 as Record<string, string>)[slug]);
      expect(el.style.left).toBe(`${anchors.anchors[slug].x}%`);
      expect(el.style.top).toBe(`${anchors.anchors[slug].y}%`);
    }
  });

  it("uses the current language", () => {
    setup("vi");
    expect(screen.getByTestId("destination-hon_sup").textContent).toContain("Hòn Sụp");
    expect(screen.getByTestId("map-note").textContent).toBe(voyageVi.note);
  });

  it("marks only Ly Son as the finish with a text marker", () => {
    setup("en");
    expect(screen.getByTestId("destination-ly_son").textContent).toContain("(Finish)");
    expect(screen.getAllByTestId("finish-marker")).toHaveLength(1);
  });

  it("renders a 16:10 box and the illustrative note", () => {
    setup("en");
    expect(screen.getByTestId("route-map").style.aspectRatio).toBe("16 / 10");
    expect(screen.getByText(voyageEn.note)).toBeTruthy();
  });
});
