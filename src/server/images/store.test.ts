import { describe, expect, it } from "vitest";
import { detectImageType } from "./store";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const webp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from("WEBPVP8 "),
]);

describe("detectImageType", () => {
  it.each([
    ["image/png", png],
    ["image/jpeg", jpeg],
    ["image/webp", webp],
  ])("detects %s from its magic bytes", (mime, bytes) => {
    expect(detectImageType(bytes)).toBe(mime);
  });

  it.each([
    ["GIF", Buffer.from("GIF89a\x01\x00\x01\x00")],
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ["text", Buffer.from("hello, this is not an image")],
    [
      "RIFF but not WebP",
      Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")]),
    ],
    ["a truncated PNG signature", png.subarray(0, 4)],
    ["empty", Buffer.alloc(0)],
  ])("returns null for %s", (_name, bytes) => {
    expect(detectImageType(bytes)).toBeNull();
  });
});
