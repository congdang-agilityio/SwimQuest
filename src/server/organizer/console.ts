import type { StartSetBy } from "@prisma/client";
import {
  effectiveStatus,
  isArchivable,
  isStartLocked,
  startLockAt,
  uploadWindowEndsAt,
  type TournamentStatus,
} from "@/lib/tournaments/lifecycle";
import { requireOrganizer } from "@/server/auth/roles";
import { db } from "@/server/db";
import { ensureStartsAssigned } from "@/server/jobs/tick";

/** Timeline instants are UTC `Date`s; format them in Vietnam time at the edge (`utcToVnParts`). */
export type ConsoleTimeline = {
  publishedAt: Date | null;
  seasonStartAt: Date;
  startChoiceLocksAt: Date;
  seasonEndAt: Date;
  uploadWindowEndsAt: Date;
};

export type ConsoleTeamStart = {
  teamId: string;
  teamName: string;
  /** Null while the team has no start. */
  slug: string | null;
  setBy: StartSetBy | null;
  locked: boolean;
  /** True when the team has no start and the lock has passed (automatic assignment is due). */
  dueForAutomatic: boolean;
  /** When a team without a start gets one automatically (the start-choice lock); else null. */
  automaticAssignmentAt: Date | null;
};

export type ConsoleOverview = {
  tournamentId: string;
  name: string;
  /** Status derived from time (a PUBLISHED tournament past its start is ACTIVE). */
  status: TournamentStatus;
  timeline: ConsoleTimeline;
  actions: { canPublish: boolean; canArchive: boolean };
  startsLocked: boolean;
  starts: ConsoleTeamStart[];
};

/**
 * Header data of the organizer console (story S-65 AC 2 and AC 4): effective status, timeline,
 * allowed actions and each team's start status. Organizer only (throws the role errors of
 * `requireOrganizer`). Runs `ensureStartsAssigned` first so starts due at the lock are shown as
 * assigned; `now` is the server clock.
 */
export async function getConsoleOverview(
  organizerId: string,
  tournamentId: string,
  now: Date = new Date(),
): Promise<ConsoleOverview> {
  await requireOrganizer(organizerId, tournamentId);
  await ensureStartsAssigned(tournamentId, now);
  const t = await requireOrganizer(organizerId, tournamentId);
  const teams = await db.team.findMany({
    where: { tournamentId },
    select: { id: true, name: true, startDestination: true, startSetBy: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const status = effectiveStatus(t, now);
  const lockAt = startLockAt(t);
  const locked = t.status !== "DRAFT" && isStartLocked(t, now);
  return {
    tournamentId: t.id,
    name: t.name,
    status,
    timeline: {
      publishedAt: t.publishedAt,
      seasonStartAt: t.seasonStartAt,
      startChoiceLocksAt: lockAt,
      seasonEndAt: t.seasonEndAt,
      uploadWindowEndsAt: uploadWindowEndsAt(t),
    },
    actions: { canPublish: t.status === "DRAFT", canArchive: isArchivable(t, now) },
    startsLocked: locked,
    starts: teams.map((team) => {
      const hasStart = team.startDestination !== null;
      return {
        teamId: team.id,
        teamName: team.name,
        slug: team.startDestination,
        setBy: team.startSetBy,
        locked,
        dueForAutomatic: !hasStart && locked,
        automaticAssignmentAt: hasStart || t.status === "DRAFT" ? null : lockAt,
      };
    }),
  };
}
