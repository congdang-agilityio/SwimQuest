import { describe, expect, it } from "vitest";
import { EMBLEM_KEYS, emblemPath, isEmblemKey } from "./emblems";

describe("emblems", () => {
  it("lists six unique keys", () => {
    expect(EMBLEM_KEYS).toHaveLength(6);
    expect(new Set(EMBLEM_KEYS).size).toBe(6);
  });

  it("accepts every known key", () => {
    for (const key of EMBLEM_KEYS) expect(isEmblemKey(key)).toBe(true);
  });

  it.each(["", "Turtle", "shark", "toString", "__proto__", null, undefined, 3, {}])(
    "rejects %s",
    (value) => {
      expect(isEmblemKey(value)).toBe(false);
    },
  );

  it("maps a key to its svg path", () => {
    expect(emblemPath("turtle")).toBe("/art/emblems/turtle.svg");
  });
});
