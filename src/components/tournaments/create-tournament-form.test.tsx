// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/tournaments.json";
import viMessages from "../../../messages/vi/tournaments.json";
import enRoutes from "../../../messages/en/routes.json";
import viRoutes from "../../../messages/vi/routes.json";
import { CreateTournamentForm } from "./create-tournament-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(locale: "vi" | "en" = "en") {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={{
        tournaments: locale === "vi" ? viMessages : en,
        routes: locale === "vi" ? viRoutes : enRoutes,
      }}
    >
      <CreateTournamentForm />
    </NextIntlClientProvider>,
  );
}
const set = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("CreateTournamentForm", () => {
  it("pre-fills 00:00 and 23:59 from the picked dates and keeps times editable", () => {
    setup();
    const times = screen.getAllByLabelText(/Time \(Vietnam time/) as HTMLInputElement[];
    const dates = screen.getAllByLabelText("Date") as HTMLInputElement[];
    fireEvent.change(dates[0], { target: { value: "2026-11-01" } });
    fireEvent.change(dates[1], { target: { value: "2026-11-30" } });
    expect(times[0].value).toBe("00:00");
    expect(times[1].value).toBe("23:59");
    fireEvent.change(times[0], { target: { value: "06:30" } });
    fireEvent.change(dates[0], { target: { value: "2026-11-02" } });
    expect(times[0].value).toBe("06:30");
  });

  it.each(["0", "-5", "abc", ""])("rejects distance %j at the field and does not submit", (km) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setup();
    set(/Route distance/, km);
    fireEvent.submit(screen.getByRole("form"));
    const input = screen.getByLabelText(/Route distance/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby")!;
    expect(describedBy).toContain("routeDistanceKm-error");
    expect(document.getElementById("routeDistanceKm-error")?.getAttribute("role")).toBe("alert");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a server error at its field and keeps every other entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              fields: { seasonEnd: "SEASON_END_NOT_AFTER_START" },
            },
          },
          { status: 400 },
        ),
      ),
    );
    setup();
    set(/Tournament name/, "Giải Hè");
    set(/Description/, "Mô tả");
    const dates = screen.getAllByLabelText("Date");
    fireEvent.change(dates[0], { target: { value: "2026-11-01" } });
    fireEvent.change(dates[1], { target: { value: "2026-11-30" } });
    set(/Route distance/, "120");
    fireEvent.submit(screen.getByRole("form"));
    expect(await screen.findByText("The season end must be after the season start.")).toBeTruthy();
    expect((screen.getByLabelText(/Tournament name/) as HTMLInputElement).value).toBe("Giải Hè");
    expect((screen.getByLabelText(/Route distance/) as HTMLInputElement).value).toBe("120");
    expect((dates[0] as HTMLInputElement).value).toBe("2026-11-01");
  });

  it("has Vietnamese copy labelled as Vietnam time", () => {
    setup("vi");
    expect(screen.getAllByLabelText(/giờ Việt Nam/)).toHaveLength(2);
  });
});
