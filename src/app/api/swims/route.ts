import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin } from "@/server/http/request";
import * as upload from "@/server/swims/create-from-upload";
import { ParseError } from "@/server/swims/parse/types";
import { toOwnerSwimDto } from "@/server/swims/swim-dto";

export const runtime = "nodejs";
const MAX_BODY_BYTES = upload.MAX_UPLOAD_BYTES + 64 * 1024; // the file + multipart overhead
async function readCappedForm(request: Request): Promise<FormData | null | "FILE_TOO_LARGE"> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return "FILE_TOO_LARGE";
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  for await (const chunk of request.body ?? []) {
    if ((size += chunk.length) > MAX_BODY_BYTES) return "FILE_TOO_LARGE"; // cancels the stream
    chunks.push(chunk);
  }
  return new Request(request, { body: new Blob(chunks) }).formData().catch(() => null);
}

/** POST /api/swims: one GPX/FIT file as multipart field `file`; 201 `{ swim }`. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const form = await readCappedForm(request);
  if (form === "FILE_TOO_LARGE") return apiError(400, form);
  const file = form?.get("file"); // other fields (e.g. userId) are ignored
  if (!(file instanceof File)) return apiError(400, "FILE_REQUIRED");
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const swim = await upload.createSwimFromUpload(auth.user.id, { buffer, filename: file.name });
    const headers = { "cache-control": "no-store" };
    return NextResponse.json({ swim: toOwnerSwimDto(swim) }, { status: 201, headers });
  } catch (err) {
    if (!(err instanceof ParseError || err instanceof upload.UploadError)) throw err;
    return apiError(400, err.code === "INVALID_UPLOAD" ? "FILE_REQUIRED" : err.code);
  }
}
