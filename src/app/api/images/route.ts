import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";
import { ImageError, MAX_IMAGE_BYTES, storeImage } from "@/server/images/store";

export const runtime = "nodejs";
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024; // the file + multipart overhead

async function readCappedForm(request: Request): Promise<FormData | null | "IMAGE_TOO_LARGE"> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return "IMAGE_TOO_LARGE";
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  for await (const chunk of request.body ?? []) {
    if ((size += chunk.length) > MAX_BODY_BYTES) return "IMAGE_TOO_LARGE"; // cancels the stream
    chunks.push(chunk);
  }
  return new Request(request, { body: new Blob(chunks) }).formData().catch(() => null);
}

/** POST /api/images: multipart `{ kind, file }` (PNG, JPEG or WebP, up to 2 MB); 201 `{ id }`. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const form = await readCappedForm(request);
  if (form === "IMAGE_TOO_LARGE") return apiError(400, form);
  const file = form?.get("file");
  if (!(file instanceof File)) return apiError(400, "VALIDATION_FAILED", { file: "FILE_REQUIRED" });
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = await storeImage(auth.user.id, form?.get("kind"), buffer, file.type);
    return NextResponse.json(
      { id: image.id },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (!(err instanceof ImageError)) throw err;
    if (err.code === "INVALID_KIND") {
      return apiError(400, "VALIDATION_FAILED", { kind: "INVALID_KIND" });
    }
    return apiError(400, err.code);
  }
}
