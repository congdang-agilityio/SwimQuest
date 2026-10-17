import type { SwimType, SwimTypeAllowed } from "@prisma/client";
import { vnDayKey } from "@/lib/time/vn";
import type { Reason } from "./reasons";

/** The swim facts the rule checks read; `createdAt` is the upload time. */
export type RuleSwim = {
  swimType: SwimType;
  startedAt: Date;
  createdAt: Date;
  /** Whole metres; the standard checks already refused a swim without a usable distance. */
  distanceM: number | null;
  durationS: number;
};

/** The organizer's rules of one tournament. */
export type RuleTournament = {
  swimTypeAllowed: SwimTypeAllowed;
  /** N: days after the swim date (Vietnam time) an upload still counts. */
  submissionDays: number;
  /** M: days after the season end time an upload still counts. */
  lateUploadDays: number;
  seasonEndAt: Date;
  /** Extra rule (S-27): shortest swim that counts, in metres; null means off. */
  minSwimDistanceM: number | null;
  /** Extra rule (S-27): slowest pace per 100 m that counts, in seconds; null means off. */
  extraSlowestPaceSecPer100m: number | null;
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
 *
 * Extra rules (S-27), when set: a swim shorter than the minimum distance, or slower than the
 * extra slowest pace, misses the rule (both limits inclusive). The realistic slowest pace is a
 * standard check and runs first, so a swim outside it is flagged for review instead.
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
  // Same window as uploadWindowEndsAt: results are final from that moment.
  const windowEnd = tournament.seasonEndAt.getTime() + tournament.lateUploadDays * 86_400_000;
  if (swim.createdAt.getTime() >= windowEnd) {
    missed.push({ code: "UPLOAD_WINDOW_CLOSED", params: { days: tournament.lateUploadDays } });
  }
  const distanceM = swim.distanceM;
  if (distanceM !== null && distanceM > 0) {
    const minM = tournament.minSwimDistanceM;
    if (minM !== null && distanceM < minM) {
      missed.push({ code: "MIN_DISTANCE_MISSED", params: { limitM: minM, valueM: distanceM } });
    }
    const limitSec = tournament.extraSlowestPaceSecPer100m;
    // Compared without dividing, like the standard pace check, so a swim on the limit counts.
    if (limitSec !== null && swim.durationS * 100 > distanceM * limitSec) {
      const valueSec = Math.round((swim.durationS * 100) / distanceM);
      missed.push({ code: "EXTRA_PACE_MISSED", params: { limitSec, valueSec } });
    }
  }
  return { missed };
}

/** Whole calendar days from one YYYY-MM-DD date to another. */
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
