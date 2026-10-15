// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import vi_ from "../../../messages/vi/publish.json";
import { PublishPanel } from "./publish-panel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockClear();
});

function setup() {
  render(
    <NextIntlClientProvider locale="vi" messages={{ publish: vi_ }}>
      <PublishPanel tournamentId="t1" />
    </NextIntlClientProvider>,
  );
}
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("PublishPanel", () => {
  it("links to the preview and asks for confirmation before publishing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setup();
    expect(screen.getByRole("link", { name: "Xem trước" }).getAttribute("href")).toBe(
      "/tournaments/t1/manage/preview",
    );
    fireEvent.click(screen.getByRole("button", { name: "Công bố" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Đồng ý, công bố" })).toBeTruthy();
  });

  it("lists the 422 issues in plain words, linking to the team list and the details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        json(422, {
          error: {
            code: "PUBLISH_INVALID",
            issues: [
              { code: "NO_TEAM", field: "teams" },
              { code: "SEASON_END_NOT_AFTER_START", field: "seasonEnd" },
            ],
          },
        }),
      ),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Công bố" }));
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý, công bố" }));
    const team = await screen.findByRole("link", { name: "Hãy thêm ít nhất một đội." });
    expect(team.getAttribute("href")).toBe("#teams-title");
    expect(
      screen
        .getByRole("link", { name: "Mùa giải phải kết thúc sau khi bắt đầu." })
        .getAttribute("href"),
    ).toBe("#season");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sends one request for a double click, disables the button, and refreshes on success", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Công bố" }));
    const yes = screen.getByRole("button", { name: "Đồng ý, công bố" });
    fireEvent.click(yes);
    fireEvent.click(yes);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole("button", { name: "Đang công bố..." }) as HTMLButtonElement).disabled,
    ).toBe(true);
    resolve(new Response(JSON.stringify({ status: "PUBLISHED" }), { status: 200 }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("allows a retry after a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockImplementation(() => json(200, { status: "PUBLISHED" }));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Công bố" }));
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý, công bố" }));
    expect(await screen.findByText(/Yêu cầu chưa gửi được/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý, công bố" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
