import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { newInviteToken } from "./publish";

export type InviteLink = { id: string; inviteEnabled: boolean; inviteToken: string };

/** A refused invite link change: bad input (400) or a tournament with no link yet (409). */
export class InviteLinkError extends Error {
  readonly status: 400 | 409;
  constructor(readonly code: "INVALID_INPUT" | "NO_INVITE_LINK") {
    super(code);
    this.status = code === "INVALID_INPUT" ? 400 : 409;
  }
}

const selectLink = { id: true, inviteEnabled: true, inviteToken: true } as const;

async function organizerLink(userId: string, id: string) {
  const t = await requireOrganizer(userId, id, { write: true });
  if (!t.inviteToken) throw new InviteLinkError("NO_INVITE_LINK");
  return t;
}

/**
 * Switches the invite link off or on again (story S-34 AC 1, AC 2). Organizer only. The token
 * is kept, so switching on re-enables the same link. Only a real change is written and audited
 * (`INVITE_LINK_SWITCHED`); memberships are never touched.
 */
export async function setInviteEnabled(
  userId: string,
  id: string,
  enabled: boolean,
): Promise<InviteLink> {
  if (typeof enabled !== "boolean") throw new InviteLinkError("INVALID_INPUT");
  await organizerLink(userId, id);
  return db.$transaction(async (tx) => {
    const { count } = await tx.tournament.updateMany({
      where: { id, inviteEnabled: !enabled, inviteToken: { not: null } },
      data: { inviteEnabled: enabled },
    });
    if (count === 1) {
      await recordAudit(tx, {
        actor: { type: "USER", userId },
        action: AUDIT_ACTIONS.INVITE_LINK_SWITCHED,
        entityType: "Tournament",
        entityId: id,
        tournamentId: id,
        before: { inviteEnabled: !enabled },
        after: { inviteEnabled: enabled },
      });
    }
    const t = await tx.tournament.findUniqueOrThrow({ where: { id }, select: selectLink });
    if (!t.inviteToken) throw new InviteLinkError("NO_INVITE_LINK");
    return { ...t, inviteToken: t.inviteToken };
  });
}

/**
 * Replaces the invite link with a new 32-byte token (story S-34 AC 3). Organizer only. The old
 * token, and every captain link built on it, stops working at once; the new link is on.
 * Audited as `INVITE_LINK_REPLACED` without either token (link secrets are never stored there).
 */
export async function replaceInviteToken(userId: string, id: string): Promise<InviteLink> {
  const before = await organizerLink(userId, id);
  const inviteToken = newInviteToken();
  return db.$transaction(async (tx) => {
    const { count } = await tx.tournament.updateMany({
      where: { id, inviteToken: { not: null } },
      data: { inviteToken, inviteEnabled: true },
    });
    if (count !== 1) throw new InviteLinkError("NO_INVITE_LINK");
    await recordAudit(tx, {
      actor: { type: "USER", userId },
      action: AUDIT_ACTIONS.INVITE_LINK_REPLACED,
      entityType: "Tournament",
      entityId: id,
      tournamentId: id,
      before: { inviteEnabled: before.inviteEnabled },
      after: { inviteEnabled: true },
    });
    return { id, inviteEnabled: true, inviteToken };
  });
}
