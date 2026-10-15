import type { db } from "@/server/db";

/** Works with the shared client and with a transaction client. */
type SwimReader = Pick<typeof db, "swim">;

export type DuplicateCandidate = { fileSha256: string; startedAt: Date; endedAt: Date };

/**
 * Id of the player's earliest non-duplicate swim that is the same file or overlaps in time
 * with the candidate, or null. Touching intervals do not overlap. Other players are never matched.
 * With `excludeSwimId` (re-checking a stored swim), only swims created before that swim match
 * (`createdAt`, then `id` as tie-break), so two stored swims can never match each other.
 */
export async function findDuplicateOf(
  tx: SwimReader,
  userId: string,
  candidate: DuplicateCandidate,
  excludeSwimId?: string,
): Promise<string | null> {
  const excluded = excludeSwimId
    ? await tx.swim.findUnique({
        where: { id: excludeSwimId },
        select: { id: true, createdAt: true },
      })
    : null;
  const match = await tx.swim.findFirst({
    where: {
      userId,
      duplicateOfId: null,
      ...(excludeSwimId ? { id: { not: excludeSwimId } } : {}),
      AND: [
        {
          OR: [
            { fileSha256: candidate.fileSha256 },
            { startedAt: { lt: candidate.endedAt }, endedAt: { gt: candidate.startedAt } },
          ],
        },
        ...(excluded
          ? [
              {
                OR: [
                  { createdAt: { lt: excluded.createdAt } },
                  { createdAt: excluded.createdAt, id: { lt: excluded.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return match?.id ?? null;
}
