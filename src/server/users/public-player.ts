import type { Prisma } from "@prisma/client";

/**
 * The only user fields other players may see (NFR-05: email is private). Every query that
 * shows a player to someone else selects with this, never with the full user row.
 */
export const PUBLIC_PLAYER_SELECT = {
  id: true,
  displayName: true,
} as const satisfies Prisma.UserSelect;

/** A player as other players see them: exactly `{ id, displayName }`, never an email. */
export type PublicPlayer = Readonly<Prisma.UserGetPayload<{ select: typeof PUBLIC_PLAYER_SELECT }>>;

/**
 * Projects any user-like row onto its public fields. Copies only `id` and `displayName`, so
 * private fields (email, password hash, status, ...) on the input never reach the output.
 */
export function toPublicPlayer(user: Pick<PublicPlayer, "id" | "displayName">): PublicPlayer {
  return { id: user.id, displayName: user.displayName };
}
