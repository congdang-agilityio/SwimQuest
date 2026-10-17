// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/captain.json";
import vi_ from "../../../messages/vi/captain.json";
import { RosterList } from "./roster-list";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockClear();
});

const members = [
  { id: "u1", displayName: "Lan", isCaptain: false },
  { id: "u2", displayName: "Minh", isCaptain: false },
];

function setup(rows: typeof members) {
  render(
    <NextIntlClientProvider locale="vi" messages={{ captain: vi_ }}>
      <RosterList teamId="t1" members={rows} />
    </NextIntlClientProvider>,
  );
}

describe("RosterList", () => {
  it("offers Make captain to every member when there is no captain", () => {
    setup(members);
    expect(screen.getByText("Lan")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Chọn .* làm đội trưởng/ })).toHaveLength(2);
    expect(screen.queryByText("Đội trưởng")).toBeNull();
  });

  it("marks the captain with text and offers Make captain to the others only", () => {
    setup([{ ...members[0], isCaptain: true }, members[1]]);
    expect(screen.getByText("Đội trưởng").tagName).toBe("STRONG");
    expect(screen.getAllByRole("button", { name: /làm đội trưởng/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Chọn Minh làm đội trưởng" })).toBeTruthy();
  });

  it("PUTs the member to the captain API and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    setup(members);
    fireEvent.click(screen.getByRole("button", { name: "Chọn Minh làm đội trưởng" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/teams/t1/captain",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ userId: "u2" }) }),
    );
  });

  it("shows an alert when the API refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    setup(members);
    fireEvent.click(screen.getByRole("button", { name: "Chọn Lan làm đội trưởng" }));
    await screen.findByRole("alert");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("has the same keys in vi and en", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(vi_).sort());
  });
});
