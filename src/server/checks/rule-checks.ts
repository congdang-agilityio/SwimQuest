import type { SwimType, SwimTypeAllowed } from "@prisma/client";
import type { Reason } from "./reasons";

/** The swim facts the rule checks read. */
export type RuleSwim = { swimType: SwimType };

/** The organizer's rules of one tournament. */
export type RuleTournament = { swimTypeAllowed: SwimTypeAllowed };

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
 */
export function evaluateRules(swim: RuleSwim, tournament: RuleTournament): { missed: Reason[] } {
  const missed: Reason[] = [];
  const allowed = tournament.swimTypeAllowed;
  if (!(ACCEPTED[allowed] ?? []).includes(swim.swimType)) {
    missed.push({ code: "SWIM_TYPE_NOT_ACCEPTED", params: { allowed, value: swim.swimType } });
  }
  return { missed };
}
