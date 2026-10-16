import { ImageKind } from "@prisma/client";
import { db } from "@/server/db";

/** Largest accepted image: 2 MB. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";
export type ImageErrorCode = "IMAGE_TYPE_NOT_ALLOWED" | "IMAGE_TOO_LARGE" | "INVALID_KIND";

export class ImageError extends Error {
  constructor(readonly code: ImageErrorCode) {
    super(code);
    this.name = "ImageError";
  }
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const startsWith = (buf: Buffer, sig: number[], at = 0) =>
  buf.length >= at + sig.length && sig.every((byte, i) => buf[at + i] === byte);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** The image type from the file's magic bytes; null for anything but PNG, JPEG or WebP. */
export function detectImageType(buf: Buffer): ImageMime | null {
  if (startsWith(buf, PNG)) return "image/png";
  if (startsWith(buf, JPEG)) return "image/jpeg";
  if (startsWith(buf, ascii("RIFF")) && startsWith(buf, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

/**
 * Stores an image owned by `userId` (from the session, never the request). The type comes from
 * the bytes only; a non-empty `claimedType` that differs from them is refused. File names are
 * never used. Returns the new image's unguessable id.
 */
export async function storeImage(
  userId: string,
  kind: unknown,
  buffer: Buffer,
  claimedType = "",
): Promise<{ id: string }> {
  if (typeof kind !== "string" || !Object.hasOwn(ImageKind, kind)) {
    throw new ImageError("INVALID_KIND");
  }
  if (buffer.length > MAX_IMAGE_BYTES) throw new ImageError("IMAGE_TOO_LARGE");
  const mime = detectImageType(buffer);
  if (!mime || (claimedType !== "" && claimedType.toLowerCase() !== mime)) {
    throw new ImageError("IMAGE_TYPE_NOT_ALLOWED");
  }
  const bytes = new Uint8Array(buffer);
  return db.imageAsset.create({
    data: { ownerId: userId, kind: kind as ImageKind, mime, bytes, sizeBytes: buffer.length },
    select: { id: true },
  });
}

const ID_PATTERN = /^[a-z0-9]{1,64}$/;

/** A stored image by id, or null for an unknown or malformed id. */
export async function findImage(id: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
  if (!ID_PATTERN.test(id)) return null;
  return db.imageAsset.findUnique({ where: { id }, select: { mime: true, bytes: true } });
}
