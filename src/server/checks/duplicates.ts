import type { db } from "@/server/db";

/** Works with the shared client and with a transaction client. */
type SwimReader = Pick<typeof db, "swim">;

export type DuplicateCandidate = { fileSha256: string; startedAt: Date; endedAt: Date };

/**
 * Id of the player's earliest non-duplicate swim that is the same file or overlaps in time
 * with the candidate, or null. Touching intervals do not overlap. Other players are never matched.
 */
export async function findDuplicateOf(
  tx: SwimReader,
  userId: string,
  candidate: DuplicateCandidate,
  excludeSwimId?: string,
): Promise<string | null> {
  const match = await tx.swim.findFirst({
    where: {
      userId,
      duplicateOfId: null,
      ...(excludeSwimId ? { id: { not: excludeSwimId } } : {}),
      OR: [
        { fileSha256: candidate.fileSha256 },
        { startedAt: { lt: candidate.endedAt }, endedAt: { gt: candidate.startedAt } },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return match?.id ?? null;
}
