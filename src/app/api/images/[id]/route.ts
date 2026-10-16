import { apiError } from "@/server/http/api-error";
import { findImage } from "@/server/images/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/images/:id: the stored bytes, public by (unguessable) id and cached forever. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const image = await findImage((await params).id);
  if (!image) return apiError(404, "NOT_FOUND");
  return new Response(new Uint8Array(image.bytes), {
    status: 200,
    headers: {
      "content-type": image.mime,
      "content-length": String(image.bytes.length),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
