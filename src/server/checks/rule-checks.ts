import type { SwimType, SwimTypeAllowed } from "@prisma/client";
import { uploadWindowEndsAt } from "@/lib/tournaments/lifecycle";
import { vnDayKey } from "@/lib/time/vn";
import type { Reason } from "./reasons";

/** The swim facts the rule checks read; `createdAt` is the upload time. */
export type RuleSwim = { swimType: SwimType; startedAt: Date; createdAt: Date };

/** The organizer's rules of one tournament. */
export type RuleTournament = {
  swimTypeAllowed: SwimTypeAllowed;
  /** N: days after the swim date (Vietnam time) an upload still counts. */
  submissionDays: number;
  /** M: days after the season end time an upload still counts. */
  lateUploadDays: number;
  seasonEndAt: Date;
};

const ACCEPTED: Record<SwimTypeAllowed, readonly SwimType[]> = {
  ANY: ["POOL", "OPEN_WATER", "UNKNOWN"],
  POOL_ONLY: ["POOL", "UNKNOWN"],
  OPEN_WATER_ONLY: ["OPEN_WATER", "UNKNOWN"],
};

/**
 * Organizer rule checks of one swim against one tournament (S-23). They run only on a swim
 * that passed the standard checks; a missed rule means the swim does not count there, without
 * review. A swim of type UNKNOWN passes the swim type rule: the file cannot tell its type, and
 * refusing it would punish players for their device.
 *
 * Deadlines (S-24): an upload on a Vietnam calendar day more than N days after the swim's
 * Vietnam date misses the submission deadline; an upload at or after the season end time plus
 * M days misses the upload window (the moment results become final).
 */
export function evaluateRules(swim: RuleSwim, tournament: RuleTournament): { missed: Reason[] } {
  const missed: Reason[] = [];
  const allowed = tournament.swimTypeAllowed;
  if (!(ACCEPTED[allowed] ?? []).includes(swim.swimType)) {
    missed.push({ code: "SWIM_TYPE_NOT_ACCEPTED", params: { allowed, value: swim.swimType } });
  }
  const swimDate = vnDayKey(swim.startedAt);
  if (daysBetween(swimDate, vnDayKey(swim.createdAt)) > tournament.submissionDays) {
    missed.push({
      code: "UPLOADED_AFTER_DEADLINE",
      params: { days: tournament.submissionDays, swimDate },
    });
  }
  if (swim.createdAt.getTime() >= uploadWindowEndsAt(tournament).getTime()) {
    missed.push({ code: "UPLOAD_WINDOW_CLOSED", params: { days: tournament.lateUploadDays } });
  }
  return { missed };
}

/** Whole calendar days from one YYYY-MM-DD date to another. */
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
