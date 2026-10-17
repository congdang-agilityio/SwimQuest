import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, publicOrigin, readJson } from "@/server/http/request";
import {
  InviteLinkError,
  replaceInviteToken,
  setInviteEnabled,
  type InviteLink,
} from "@/server/tournaments/invite-link";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function linkResponse(request: Request, link: InviteLink) {
  const inviteUrl = `${publicOrigin(request)}/join/${link.inviteToken}`;
  return NextResponse.json(
    { inviteEnabled: link.inviteEnabled, inviteUrl },
    { headers: { "cache-control": "no-store" } },
  );
}

function failure(err: unknown) {
  const response = roleErrorResponse(err);
  if (response) return response;
  if (err instanceof InviteLinkError) {
    return err.code === "INVALID_INPUT"
      ? apiError(400, "VALIDATION_FAILED", { enabled: "Must be true or false." })
      : apiError(409, "NO_INVITE_LINK");
  }
  throw err;
}

/** PATCH /api/tournaments/:id/invite-link `{ enabled }`: organizer switches the link off or on. */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const json = await readJson(request);
  if (!json.ok || typeof json.body !== "object" || json.body === null || Array.isArray(json.body)) {
    return apiError(400, "INVALID_BODY");
  }
  try {
    const link = await setInviteEnabled(
      auth.user.id,
      (await params).id,
      (json.body as { enabled?: unknown }).enabled as boolean,
    );
    return linkResponse(request, link);
  } catch (err) {
    return failure(err);
  }
}

/** POST /api/tournaments/:id/invite-link: organizer replaces the link; returns the new one. */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  try {
    return linkResponse(request, await replaceInviteToken(auth.user.id, (await params).id));
  } catch (err) {
    return failure(err);
  }
}
