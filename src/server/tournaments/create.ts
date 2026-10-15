import { DEFAULT_SWIM_LIMITS } from "@/lib/swim-limits";
import { parseTournamentDraft, type TournamentDraftErrors } from "@/lib/validation/tournament";
import { db } from "@/server/db";

/** P0 settings (FR-78 items 1, 2, 7); organizers change them in S-23 to S-25. */
const DEFAULT_SETTINGS = { longestSwimCountedM: 10_000, dailyLimitM: 10_000, pointsPerKm: 10 };

/**
 * Stores a validated DRAFT organized by `userId` (the signed-in user; FR-21) with the platform
 * swim limits and P0 setting defaults copied in. Only validated fields are stored, so an
 * organizer, status or setting sent in the input is ignored.
 */
export async function createDraft(
  userId: string,
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; errors: TournamentDraftErrors }> {
  const parsed = parseTournamentDraft(input);
  if (!parsed.ok) return parsed;
  const { id } = await db.tournament.create({
    data: {
      ...parsed.data,
      ...DEFAULT_SWIM_LIMITS,
      ...DEFAULT_SETTINGS,
      organizerId: userId,
      status: "DRAFT",
    },
    select: { id: true },
  });
  return { ok: true, id };
}
