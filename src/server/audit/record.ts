import type { Prisma } from "@prisma/client";

/** Audited action names. Add new privileged actions here; never use free-form strings. */
export const AUDIT_ACTIONS = {
  TEAM_CAPTAIN_SET: "TEAM_CAPTAIN_SET",
  TEAM_CAPTAIN_HANDOVER: "TEAM_CAPTAIN_HANDOVER",
  TEAM_DETAILS_UPDATED: "TEAM_DETAILS_UPDATED",
  TEAM_START_AUTO_ASSIGNED: "TEAM_START_AUTO_ASSIGNED",
  TEAM_START_SET_BY_ORGANIZER: "TEAM_START_SET_BY_ORGANIZER",
  TEAM_MEMBER_REMOVED: "TEAM_MEMBER_REMOVED",
  PLAYER_MOVED: "PLAYER_MOVED",
  INVITE_LINK_SWITCHED: "INVITE_LINK_SWITCHED",
  INVITE_LINK_REPLACED: "INVITE_LINK_REPLACED",
  ADMIN_ROLE_CHANGED: "ADMIN_ROLE_CHANGED",
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
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

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
export type AuditClient = {
  auditEvent: {
    create(args: { data: Prisma.AuditEventUncheckedCreateInput }): PromiseLike<unknown>;
  };
};

/**
 * Writes one audit event with the given client, so it commits or rolls back together with
 * the audited change. `createdAt` is set by the database.
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
}
