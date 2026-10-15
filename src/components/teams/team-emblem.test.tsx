// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeamEmblem } from "./team-emblem";

afterEach(cleanup);

describe("TeamEmblem", () => {
  it("renders the emblem image with the given alt and size", () => {
    render(<TeamEmblem emblemKey="dolphin" size={48} alt="Dolphin emblem" />);
    const img = screen.getByAltText("Dolphin emblem");
    expect(img.getAttribute("src")).toBe("/art/emblems/dolphin.svg");
    expect(img.getAttribute("width")).toBe("48");
    expect(img.getAttribute("height")).toBe("48");
  });

  it("shows a neutral fallback for an unknown key", () => {
    render(<TeamEmblem emblemKey="shark" size={32} alt="Team emblem" />);
    expect(screen.queryByRole("img", { name: "Team emblem" })?.tagName.toLowerCase()).not.toBe(
      "img",
    );
    expect(screen.getByRole("img", { name: "Team emblem" })).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows the fallback when the image fails to load", () => {
    render(<TeamEmblem emblemKey="star" size={32} alt="Star emblem" />);
    fireEvent.error(screen.getByAltText("Star emblem"));
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Star emblem" })).toBeTruthy();
  });
});
