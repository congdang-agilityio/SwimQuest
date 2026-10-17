import { NextResponse } from "next/server";
import { handleZaloUpdate } from "@/server/zalo/webhook";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ hookId: string }> };

/** Zalo updates are small; anything larger is not read. */
const BODY_MAX = 64 * 1024;

/**
 * POST /api/zalo/webhook/:hookId: Zalo Bot API updates, reachable without a session and
 * verified by `X-Bot-Api-Secret-Token`. Answers an empty JSON body; the update is never logged.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { hookId } = await params;
  let body: unknown = null;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > BODY_MAX) throw new Error("large");
    const raw = await request.text();
    body = raw.length <= BODY_MAX ? JSON.parse(raw) : null;
  } catch {
    body = null; // Malformed: verified and then ignored.
  }
  try {
    const { status } = await handleZaloUpdate(
      hookId,
      request.headers.get("x-bot-api-secret-token"),
      body,
    );
    return NextResponse.json({ ok: status === 200 }, { status });
  } catch (error) {
    // Never a 500 that would make Zalo retry forever; the next mention links the group.
    console.error("zalo: webhook failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
