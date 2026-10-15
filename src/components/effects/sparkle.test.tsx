// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sparkle } from "./sparkle";

function mockMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Sparkle", () => {
  it("plays the animation and calls onDone once after under 1.5 s", () => {
    mockMotion(false);
    const onDone = vi.fn();
    render(
      <Sparkle play onDone={onDone}>
        <span>Badge</span>
      </Sparkle>,
    );
    expect(screen.getByText("Badge")).toBeTruthy();
    expect(screen.getByTestId("sparkle").dataset.motion).toBe("animated");
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1499));
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(5000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("shows a static glow and calls onDone at once with reduced motion", () => {
    mockMotion(true);
    const onDone = vi.fn();
    render(
      <Sparkle play onDone={onDone}>
        <span>Badge</span>
      </Sparkle>,
    );
    expect(screen.getByTestId("sparkle").dataset.motion).toBe("static");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("does nothing while play is false", () => {
    mockMotion(false);
    const onDone = vi.fn();
    render(
      <Sparkle play={false} onDone={onDone}>
        <span>Badge</span>
      </Sparkle>,
    );
    expect(screen.getByTestId("sparkle").dataset.motion).toBe("idle");
    act(() => void vi.advanceTimersByTime(3000));
    expect(onDone).not.toHaveBeenCalled();
  });
});
