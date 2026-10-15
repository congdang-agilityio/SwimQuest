import { parseFit } from "./fit";
import { parseGpx } from "./gpx";
import { ParseError, type ParsedSwim } from "./types";

const GPX_HEAD = /^﻿?\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<gpx[\s>]/i;

const isFit = (b: Buffer) => b.length >= 12 && b.toString("latin1", 8, 12) === ".FIT";
const isGpx = (b: Buffer) => GPX_HEAD.test(b.toString("utf8", 0, 4096));

/** The file type from its content, or null when it is neither FIT nor GPX. */
export const detectSwimSource = (b: Buffer): "FIT" | "GPX" | null =>
  isFit(b) ? "FIT" : isGpx(b) ? "GPX" : null;

/** Picks the parser from the file content; the file name is never trusted. */
export async function parseSwimFile(buffer: Buffer, filename?: string): Promise<ParsedSwim> {
  void filename; // detection is by content only
  const source = detectSwimSource(buffer);
  if (source === "FIT") return parseFit(buffer);
  if (source === "GPX") return parseGpx(buffer);
  throw new ParseError("UNSUPPORTED_FILE", "Only GPX and FIT files are supported");
}
