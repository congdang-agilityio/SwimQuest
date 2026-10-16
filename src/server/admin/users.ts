import { z } from "zod";
import type { UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { ForbiddenError, NotFoundError, requirePlatformAdmin } from "@/server/auth/roles";

/** The admin caller. Only `id` is trusted: the role is always re-read from the database. */
export type AdminActor = { id: string; isPlatformAdmin: boolean };

/** One user as platform admins see it. The email is for admins only. */
export type AdminUserDto = {
  id: string;
  displayName: string;
  email: string;
  status: UserStatus;
  isPlatformAdmin: boolean;
  createdAt: string;
};
export type AdminUsersPage = { items: AdminUserDto[]; nextCursor: string | null };

export class InvalidCursorError extends Error {
  constructor() {
    super("INVALID_CURSOR");
    this.name = "InvalidCursorError";
  }
}

/** Removing this admin role would leave no active platform admin. */
export class LastAdminError extends Error {
  readonly status = 409;
  readonly code = "LAST_ADMIN";
}

const PAGE_SIZE = 20;
const userId = z.string().min(1).max(100);
const searchOptions = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).max(200).optional(),
});
const cursorShape = z.object({ t: z.iso.datetime(), id: userId });
const select = {
  id: true,
  displayName: true,
  email: true,
  status: true,
  isPlatformAdmin: true,
  createdAt: true,
} as const;

type UserRow = Omit<AdminUserDto, "createdAt"> & { createdAt: Date };
const toDto = (u: UserRow): AdminUserDto => ({ ...u, createdAt: u.createdAt.toISOString() });

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), id })).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const { t, id } = cursorShape.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
    return { createdAt: new Date(t), id };
  } catch {
    throw new InvalidCursorError();
  }
}

/** Refuses unless the caller is an active platform admin right now, per the database. */
async function requireAdmin(actor: AdminActor): Promise<void> {
  const id = userId.safeParse(actor?.id);
  const user = id.success
    ? await db.user.findUnique({
        where: { id: id.data },
        select: { isPlatformAdmin: true, status: true },
      })
    : null;
  requirePlatformAdmin(user?.status === "ACTIVE" ? user : null);
}

/**
 * Users matching `q` on display name or email (case-insensitive), newest first, 20 per page.
 * An empty `q` lists everyone. Pass the returned `nextCursor` to get the next page.
 */
export async function searchUsers(
  actor: AdminActor,
  options: { q?: string; cursor?: string },
): Promise<AdminUsersPage> {
  await requireAdmin(actor);
  const { q, cursor } = searchOptions.parse(options);
  const after = cursor ? decodeCursor(cursor) : null;
  const rows = await db.user.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { displayName: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {},
        after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select,
  });
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map(toDto),
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

/** One user for the admin user page; `NotFoundError` for an unknown id. */
export async function getUserForAdmin(actor: AdminActor, targetId: string): Promise<AdminUserDto> {
  await requireAdmin(actor);
  const id = userId.safeParse(targetId);
  const user = id.success ? await db.user.findUnique({ where: { id: id.data }, select }) : null;
  if (!user) throw new NotFoundError();
  return toDto(user);
}

/**
 * Grants or removes the platform admin role, in one transaction with its audit event. Role
 * checks read the database on every request, so the change applies at once. Removing the
 * last active admin is refused (`LastAdminError`); no change writes no audit event.
 */
export async function setPlatformAdmin(
  actor: AdminActor,
  targetId: string,
  isAdmin: boolean,
): Promise<AdminUserDto> {
  const value = z.boolean().parse(isAdmin);
  const id = userId.safeParse(targetId);
  return db.$transaction(async (tx) => {
    // Lock every admin row so concurrent removals cannot leave the platform without an admin.
    const admins = await tx.$queryRaw<{ id: string; status: UserStatus }[]>`
      SELECT "id", "status" FROM "User" WHERE "isPlatformAdmin" = true FOR UPDATE`;
    const active = admins.filter((a) => a.status === "ACTIVE");
    if (!active.some((a) => a.id === actor?.id)) throw new ForbiddenError();

    const target = id.success ? await tx.user.findUnique({ where: { id: id.data }, select }) : null;
    if (!target) throw new NotFoundError();
    if (target.isPlatformAdmin === value) return toDto(target);
    const isLastActive = active.length === 1 && active[0].id === target.id;
    if (!value && isLastActive) throw new LastAdminError();

    const updated = await tx.user.update({
      where: { id: target.id },
      data: { isPlatformAdmin: value },
      select,
    });
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: AUDIT_ACTIONS.ADMIN_ROLE_CHANGED,
      entityType: "User",
      entityId: target.id,
      before: { isPlatformAdmin: target.isPlatformAdmin },
      after: { isPlatformAdmin: value },
    });
    return toDto(updated);
  });
}
