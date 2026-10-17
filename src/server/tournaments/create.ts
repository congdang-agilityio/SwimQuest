import { parseTournamentDraft, type TournamentDraftErrors } from "@/lib/validation/tournament";
import { db } from "@/server/db";
import { recordFunnelEvent } from "@/server/funnel/record";
import { getSwimLimitConfig } from "@/server/platform/swim-limits-config";
import { assertCanCreateTournament } from "./quota";

/** P0 settings (FR-78 items 1, 2, 7); organizers change them in S-23 to S-25. */
const DEFAULT_SETTINGS = { longestSwimCountedM: 10_000, dailyLimitM: 10_000, pointsPerKm: 10 };

/**
 * Stores a validated DRAFT organized by `userId` (the signed-in user; FR-21) with the platform
 * swim limit defaults, a snapshot of the limit bounds (S-64) and the P0 setting defaults copied
 * in. Only validated fields are stored, so an organizer, status or setting sent in the input is
 * ignored. Throws `QUOTA_REACHED` (S-61).
 */
export async function createDraft(
  userId: string,
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; errors: TournamentDraftErrors }> {
  const parsed = parseTournamentDraft(input);
  if (!parsed.ok) return parsed;
  const { defaults, bounds } = await getSwimLimitConfig();
  const args = {
    data: {
      ...parsed.data,
      ...defaults,
      swimLimitBounds: bounds,
      ...DEFAULT_SETTINGS,
      organizerId: userId,
      status: "DRAFT" as const,
    },
    select: { id: true },
  };
  const { id } = await db.$transaction(async (tx) => {
    await assertCanCreateTournament(tx, userId);
    const created = await tx.tournament.create(args);
    await recordFunnelEvent(tx, "tournament_created", { userId, tournamentId: created.id });
    return created;
  });
  return { ok: true, id };
}
