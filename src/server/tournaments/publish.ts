import { randomBytes } from "node:crypto";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { validateForPublish, type PublishIssue } from "./validate-publish";

export type PublishedTournament = {
  id: string;
  status: "PUBLISHED";
  publishedAt: Date;
  inviteToken: string;
};

export type PublishResult =
  | { ok: true; tournament: PublishedTournament }
  | { ok: false; reason: "PUBLISH_INVALID"; issues: PublishIssue[] };

/** The shareable invite link secret: 32 random bytes, URL-safe. Never log it. */
export const newInviteToken = () => randomBytes(32).toString("base64url");

/** A tournament that is past DRAFT but has no invite token cannot be published (409). */
export class PublishError extends Error {
  readonly status = 409;
  readonly code = "NOT_DRAFT";
}

type Stored = { id: string; status: string; publishedAt: Date | null; inviteToken: string | null };

function published(t: Stored): PublishResult | null {
  if (t.status === "DRAFT" || !t.publishedAt || !t.inviteToken) return null;
  return {
    ok: true,
    tournament: {
      id: t.id,
      status: "PUBLISHED",
      publishedAt: t.publishedAt,
      inviteToken: t.inviteToken,
    },
  };
}

/**
 * Publishes a draft (story S-06 AC 3, AC 5). Organizer only (throws the role errors of
 * `requireOrganizer`). An invalid draft is refused with its issues. The write is a single
 * conditional update on `status = DRAFT`, so of repeated or concurrent calls exactly one
 * publishes; every call then returns the one stored invite token and changes nothing more.
 */
export async function publishTournament(userId: string, id: string): Promise<PublishResult> {
  const tournament = await requireOrganizer(userId, id);
  const already = published(tournament);
  if (already) return already;
  if (tournament.status !== "DRAFT") throw new PublishError("NOT_DRAFT");

  const teams = await db.team.findMany({
    where: { tournamentId: tournament.id },
    select: { id: true },
  });
  const issues = validateForPublish(tournament, teams);
  if (issues.length > 0) return { ok: false, reason: "PUBLISH_INVALID", issues };

  await db.tournament.updateMany({
    where: { id: tournament.id, status: "DRAFT" },
    data: { status: "PUBLISHED", publishedAt: new Date(), inviteToken: newInviteToken() },
  });
  const stored = await db.tournament.findUnique({
    where: { id: tournament.id },
    select: { id: true, status: true, publishedAt: true, inviteToken: true },
  });
  const result = stored && published(stored);
  if (!result) throw new PublishError("NOT_DRAFT");
  return result;
}
