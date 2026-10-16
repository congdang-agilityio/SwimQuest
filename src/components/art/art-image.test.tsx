// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shipArt } from "@/lib/art/route01-art";
import { ArtImage } from "./art-image";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const art = shipArt(1)!;

describe("ArtImage", () => {
  it("renders the image with the given alt", () => {
    render(<ArtImage art={art} alt="Ship" fallback={<span data-testid="fb" />} />);
    expect(screen.getByAltText("Ship").getAttribute("src")).toBe(art.path);
    expect(screen.queryByTestId("fb")).toBeNull();
  });

  it("renders the fallback when the image fails to load", () => {
    render(<ArtImage art={art} alt="Ship" fallback={<span data-testid="fb" />} />);
    fireEvent.error(screen.getByAltText("Ship"));
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByTestId("fb")).toBeTruthy();
  });

  it("renders the fallback when the image already failed before it mounted", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    render(<ArtImage art={art} alt="Ship" fallback={<span data-testid="fb" />} />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByTestId("fb")).toBeTruthy();
  });

  it("keeps an image that finished loading", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(64);
    render(<ArtImage art={art} alt="Ship" fallback={<span data-testid="fb" />} />);
    expect(screen.getByAltText("Ship")).toBeTruthy();
    expect(screen.queryByTestId("fb")).toBeNull();
  });

  it("renders the fallback when no art is given", () => {
    render(<ArtImage art={undefined} alt="Ship" fallback={<span data-testid="fb" />} />);
    expect(screen.getByTestId("fb")).toBeTruthy();
  });
});
