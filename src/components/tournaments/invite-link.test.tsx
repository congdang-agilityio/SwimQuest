// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import vi_ from "../../../messages/vi/publish.json";
import { InviteLink } from "./invite-link";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "execCommand");
});

function tree() {
  return (
    <NextIntlClientProvider locale="vi" messages={{ publish: vi_ }}>
      <InviteLink url="https://x.test/join/abc" tournamentName="Giải" />
    </NextIntlClientProvider>
  );
}

function setup() {
  render(tree());
}

describe("InviteLink", () => {
  it("copies with the Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    expect(await screen.findByText("Đã sao chép")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("https://x.test/join/abc");
  });

  it("falls back to execCommand when the Clipboard API is missing", async () => {
    vi.stubGlobal("navigator", {});
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    expect(await screen.findByText("Đã sao chép")).toBeTruthy();
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("tells the user to copy by hand when both ways fail", async () => {
    vi.stubGlobal("navigator", {});
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    expect(await screen.findByText(/Không sao chép được/)).toBeTruthy();
  });

  it("shows Share only when navigator.share exists and calls it with the link", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Chia sẻ" })).toBeNull();
    cleanup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: "https://x.test/join/abc" }));
  });

  it("falls back to execCommand when the Clipboard API rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    expect(await screen.findByText("Đã sao chép")).toBeTruthy();
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("removes the hidden textarea even when execCommand throws", async () => {
    vi.stubGlobal("navigator", {});
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockImplementation(() => {
        throw new Error("boom");
      }),
      configurable: true,
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    expect(await screen.findByText(/Không sao chép được/)).toBeTruthy();
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("leaves Share out of the server HTML so hydration matches on phones", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    expect(renderToString(tree())).not.toContain("Chia sẻ");
  });
});
