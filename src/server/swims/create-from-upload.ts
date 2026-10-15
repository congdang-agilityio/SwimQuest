import { createHash } from "node:crypto";
import { lockPlayerSwims, runChecks } from "@/server/checks/run-checks";
import { db } from "@/server/db";
import { detectSwimSource, parseSwimFile } from "./parse";
import { ParseError } from "./parse/types";
import { swimDtoInclude, type SwimForDto } from "./swim-dto";

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
 * The checks run in the same transaction, so the swim is returned with its per-tournament results.
 */
export async function createSwimFromUpload(
  userId: string,
  upload: SwimUpload,
): Promise<SwimForDto> {
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

  const input = {
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
  };
  return db.$transaction(async (tx) => {
    await lockPlayerSwims(tx, userId);
    // Stamp after the lock: the default (transaction start) may predate a swim we waited for.
    const swim = await tx.swim.create({ data: { ...input.data, createdAt: new Date() } });
    await runChecks(tx, swim);
    return tx.swim.findUniqueOrThrow({ where: { id: swim.id }, include: swimDtoInclude });
  });
}
