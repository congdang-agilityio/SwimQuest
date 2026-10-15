import { createHash } from "node:crypto";
import type { Swim } from "@prisma/client";
import { db } from "@/server/db";
import { detectSwimSource, parseSwimFile } from "./parse";
import { ParseError } from "./parse/types";

/** Largest accepted upload: 10 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FILENAME = 255;

export class UploadError extends Error {
  constructor(readonly code: "FILE_TOO_LARGE" | "INVALID_UPLOAD") {
    super(code);
    this.name = "UploadError";
  }
}

export type SwimUpload = { buffer: Buffer; filename: string };

/** Base name of the client's file name (no path), trimmed and capped; never trusted. */
function cleanFilename(name: unknown): string {
  const base = typeof name === "string" ? (name.split(/[\\/]/).pop() ?? "").trim() : "";
  return (base || "upload").slice(0, MAX_FILENAME);
}

/**
 * Parses an uploaded GPX/FIT file and stores it as a swim of `userId`, which must come from the
 * signed-in session, never from the request. Parse errors propagate and nothing is saved.
 * Checks and per-tournament results are not run here.
 */
export async function createSwimFromUpload(userId: string, upload: SwimUpload): Promise<Swim> {
  if (typeof userId !== "string" || userId === "") throw new UploadError("INVALID_UPLOAD");
  const buffer = upload?.buffer;
  if (!Buffer.isBuffer(buffer)) throw new UploadError("INVALID_UPLOAD");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new UploadError("FILE_TOO_LARGE");

  const parsed = await parseSwimFile(buffer, upload.filename);
  const source = detectSwimSource(buffer);
  if (!source) throw new ParseError("UNSUPPORTED_FILE");
  const track = parsed.track.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    time: p.time ? p.time.toISOString() : null,
  }));

  return db.swim.create({
    data: {
      userId,
      source,
      fileSha256: createHash("sha256").update(buffer).digest("hex"),
      originalFilename: cleanFilename(upload.filename),
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
      distanceM: parsed.distanceM,
      durationS: parsed.durationS,
      swimType: parsed.swimType,
      sport: parsed.sport,
      isSwim: parsed.isSwim,
      ...(track.length > 0 ? { track } : {}),
    },
  });
}
