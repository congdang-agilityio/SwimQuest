import { z } from "zod";
import { Prisma, type QuotaRequestStatus } from "@prisma/client";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { NotFoundError, requirePlatformAdmin } from "@/server/auth/roles";
import type { AdminActor } from "@/server/admin/users";

/** Tournaments every player may create before needing an admin-approved request (FR-70). */
export const BASE_TOURNAMENT_QUOTA = 3;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type Conflict = "QUOTA_REACHED" | "QUOTA_NOT_REACHED" | "REQUEST_PENDING" | "REQUEST_DECIDED";

/** A refused quota action: 400 for bad input (`INVALID_*`), 409 for a state conflict. */
export class QuotaError extends Error {
  readonly status: 400 | 409;
  constructor(readonly code: Conflict | "INVALID_REASON" | "INVALID_STATUS") {
    super(code);
    this.status = code.startsWith("INVALID_") ? 400 : 409;
  }
}

const reasonSchema = z.string().trim().min(1).max(500);
const statusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]).optional();
const omit = { userId: true, decidedById: true } as const;

function parseReason(reason: unknown): string {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) throw new QuotaError("INVALID_REASON");
  return parsed.data;
}

async function readQuota(client: Pick<Tx, "user" | "tournament">, userId: string) {
  const where = { id: typeof userId === "string" ? userId : "" };
  const user = await client.user.findUnique({ where, select: { extraTournamentQuota: true } });
  if (!user) throw new NotFoundError();
  const used = await client.tournament.count({ where: { organizerId: userId } });
  return { used, allowed: BASE_TOURNAMENT_QUOTA + user.extraTournamentQuota };
}

/** Locks the user's quota until the transaction ends (serializes checks and creates). */
async function lockedQuota(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-quota:${userId}`}))`;
  return readQuota(tx, userId);
}

/** Throws `QuotaError("QUOTA_REACHED")` at the limit. Call in the creating transaction. */
export async function assertCanCreateTournament(tx: Tx, userId: string): Promise<void> {
  const { used, allowed } = await lockedQuota(tx, userId);
  if (used >= allowed) throw new QuotaError("QUOTA_REACHED");
}

/** Used (every tournament created, any status), allowed and the latest request (S-61). */
export async function getQuota(userId: string) {
  const quota = await readQuota(db, userId);
  const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];
  const request = await db.tournamentQuotaRequest.findFirst({ where: { userId }, orderBy, omit });
  return { ...quota, request };
}

/** Sends a request for one more tournament: only at the limit, one pending at a time. */
export async function requestMore(userId: string, reason: string) {
  const text = parseReason(reason);
  try {
    return await db.$transaction(async (tx) => {
      const { used, allowed } = await lockedQuota(tx, userId);
      if (used < allowed) throw new QuotaError("QUOTA_NOT_REACHED");
      return tx.tournamentQuotaRequest.create({ data: { userId, reason: text }, omit });
    });
  } catch (err) {
    const duplicate = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    throw duplicate ? new QuotaError("REQUEST_PENDING") : err;
  }
}

/** Refuses unless the caller is an active platform admin right now, per the database. */
async function requireAdmin(client: Pick<Tx, "user">, actor: AdminActor): Promise<string> {
  const id = typeof actor?.id === "string" ? actor.id : "";
  const user = id ? await client.user.findUnique({ where: { id } }) : null;
  requirePlatformAdmin(user?.status === "ACTIVE" ? user : null);
  return id;
}

/**
 * Approves (one more tournament) or rejects (reason required) a pending request, audited as
 * `QUOTA_REQUEST_DECIDED` with the decision and reason in the same transaction. A request is
 * decided once: later or concurrent decisions get `REQUEST_DECIDED`.
 */
export async function decideRequest(
  admin: AdminActor,
  id: string,
  approve: boolean,
  reason: string,
) {
  const decision: QuotaRequestStatus = z.boolean().parse(approve) ? "APPROVED" : "REJECTED";
  const why = typeof reason === "string" && reason.trim() !== "" ? parseReason(reason) : null;
  if (decision === "REJECTED" && !why) throw new QuotaError("INVALID_REASON");
  return db.$transaction(async (tx) => {
    const adminId = await requireAdmin(tx, admin);
    const [request] = await tx.$queryRaw<{ userId: string; status: QuotaRequestStatus }[]>`
      SELECT "userId", "status" FROM "TournamentQuotaRequest" WHERE "id" = ${String(id)} FOR UPDATE`;
    if (!request) throw new NotFoundError();
    if (request.status !== "PENDING") throw new QuotaError("REQUEST_DECIDED");
    const user = await tx.user.update({
      where: { id: request.userId },
      data: { extraTournamentQuota: { increment: decision === "APPROVED" ? 1 : 0 } },
    });
    const data = { status: decision, decidedById: adminId, decidedAt: new Date() };
    const update = { where: { id }, data: { ...data, decisionReason: why }, omit };
    const decided = await tx.tournamentQuotaRequest.update(update);
    await recordAudit(tx, {
      actor: { type: "USER", userId: adminId },
      action: AUDIT_ACTIONS.QUOTA_REQUEST_DECIDED,
      entityType: "TournamentQuotaRequest",
      entityId: id,
      before: { status: "PENDING" },
      after: { decision, userId: user.id, extraTournamentQuota: user.extraTournamentQuota },
      reason: why ?? undefined,
    });
    return decided;
  });
}

/** Requests for the admin list, newest first, optionally of one status (at most 200). */
export async function listRequests(actor: AdminActor, status?: QuotaRequestStatus) {
  await requireAdmin(db, actor);
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) throw new QuotaError("INVALID_STATUS");
  return db.tournamentQuotaRequest.findMany({
    where: parsed.data ? { status: parsed.data } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    omit,
    include: { user: { select: { id: true, displayName: true } } },
  });
}
