import type { Prisma } from "@prisma/client";
import { recordFunnelEvent, type FunnelClient, type FunnelEventName } from "../funnel/record";

/** Audited action names. Add new privileged actions here; never use free-form strings. */
export const AUDIT_ACTIONS = {
  TEAM_CAPTAIN_SET: "TEAM_CAPTAIN_SET",
  TEAM_CAPTAIN_HANDOVER: "TEAM_CAPTAIN_HANDOVER",
  TEAM_DETAILS_UPDATED: "TEAM_DETAILS_UPDATED",
  TEAM_START_AUTO_ASSIGNED: "TEAM_START_AUTO_ASSIGNED",
  TEAM_START_SET_BY_ORGANIZER: "TEAM_START_SET_BY_ORGANIZER",
  START_CORRECTED_BY_ADMIN: "START_CORRECTED_BY_ADMIN",
  TEAM_MEMBER_REMOVED: "TEAM_MEMBER_REMOVED",
  PLAYER_MOVED: "PLAYER_MOVED",
  PLAYER_ADDED_BY_ORGANIZER: "PLAYER_ADDED_BY_ORGANIZER",
  INVITE_LINK_SWITCHED: "INVITE_LINK_SWITCHED",
  INVITE_LINK_REPLACED: "INVITE_LINK_REPLACED",
  ADMIN_ROLE_CHANGED: "ADMIN_ROLE_CHANGED",
  TOURNAMENT_UPDATED: "TOURNAMENT_UPDATED",
  TOURNAMENT_ARCHIVED: "TOURNAMENT_ARCHIVED",
  TOURNAMENT_EXPORTED: "TOURNAMENT_EXPORTED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  SWIM_LIMITS_CHANGED: "SWIM_LIMITS_CHANGED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_REACTIVATED: "ACCOUNT_REACTIVATED",
  PASSWORD_RESET_BY_ADMIN: "PASSWORD_RESET_BY_ADMIN",
  ADMIN_CONTACT_CHANGED: "ADMIN_CONTACT_CHANGED",
  SWIM_REVIEWED: "SWIM_REVIEWED",
  DISPUTE_DECIDED: "DISPUTE_DECIDED",
  SWIM_REVOKED: "SWIM_REVOKED",
  QUOTA_REQUEST_DECIDED: "QUOTA_REQUEST_DECIDED",
  REVIEW_HELPER_APPOINTED: "REVIEW_HELPER_APPOINTED",
  REVIEW_HELPER_REMOVED: "REVIEW_HELPER_REMOVED",
  SPECIAL_BADGE_GIVEN: "SPECIAL_BADGE_GIVEN",
  REPORT_CLOSED: "REPORT_CLOSED",
  ZALO_BOT_SET: "ZALO_BOT_SET",
  ZALO_BOT_REMOVED: "ZALO_BOT_REMOVED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Audited actions that are also funnel events (S-81 AC 5): score changes and admin overrides. */
const FUNNEL_FOR_ACTION: Partial<Record<AuditAction, FunnelEventName>> = {
  SWIM_REVIEWED: "score_recalculated",
  SWIM_REVOKED: "score_recalculated",
  DISPUTE_DECIDED: "score_recalculated",
  PLAYER_MOVED: "score_recalculated",
  START_CORRECTED_BY_ADMIN: "admin_override",
  TEAM_START_SET_BY_ORGANIZER: "admin_override",
  ACCOUNT_SUSPENDED: "admin_override",
  ACCOUNT_REACTIVATED: "admin_override",
  PASSWORD_RESET_BY_ADMIN: "admin_override",
};

export type AuditActor = { type: "USER"; userId: string } | { type: "SYSTEM" };

export type AuditInput = {
  actor: AuditActor;
  action: AuditAction;
  entityType: string;
  entityId: string;
  tournamentId?: string;
  /** Snapshots of the changed fields only: never secrets, password hashes or emails. */
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
};

/** Any client that can write audit events, typically the `tx` of `db.$transaction`. */
export type AuditClient = FunnelClient & {
  auditEvent: {
    create(args: { data: Prisma.AuditEventUncheckedCreateInput }): PromiseLike<unknown>;
  };
};

/**
 * Writes one audit event with the given client, so it commits or rolls back together with
 * the audited change. `createdAt` is set by the database. Score changes and admin overrides
 * also record their funnel event with the same client.
 */
export async function recordAudit(tx: AuditClient, input: AuditInput): Promise<void> {
  const { actor, ...event } = input;
  await tx.auditEvent.create({
    data: {
      ...event,
      actorType: actor.type,
      actorUserId: actor.type === "USER" ? actor.userId : null,
    },
  });
  const funnel = FUNNEL_FOR_ACTION[input.action];
  if (funnel) {
    // Same client, so the funnel row commits or rolls back with the audited change.
    await recordFunnelEvent(tx, funnel, {
      userId: actor.type === "USER" ? actor.userId : null,
      tournamentId: input.tournamentId ?? null,
      refId: input.entityId,
      props: { action: input.action },
    });
  }
}
