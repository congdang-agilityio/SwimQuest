import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/record";
import { db } from "@/server/db";
import { requireOpenTournament, ZaloSettingsError } from "./settings";
import {
  ZALO_SWITCH_KEYS,
  ZALO_SWITCH_SELECT,
  switchesOf,
  switchColumn,
  type ZaloSwitchKey,
  type ZaloSwitches,
} from "./switch-kinds";

export * from "./switch-kinds";

/**
 * Turns message kinds on or off for one tournament (S-89 AC 1, AC 2). Organizer only, refused
 * once the tournament completed and when it has no bot. Audited as `ZALO_SWITCHES_CHANGED` with
 * the changed switches' old and new values; nothing is written when nothing changes.
 */
export async function setZaloSwitches(
  userId: string,
  tournamentId: string,
  partial: Partial<ZaloSwitches>,
): Promise<ZaloSwitches> {
  await requireOpenTournament(userId, tournamentId);
  return db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ tournamentId: string }[]>`
      SELECT "tournamentId" FROM "TournamentZalo" WHERE "tournamentId" = ${tournamentId} FOR UPDATE`;
    if (!locked) throw new ZaloSettingsError("NO_BOT");
    const row = await tx.tournamentZalo.findUniqueOrThrow({
      where: { tournamentId },
      select: ZALO_SWITCH_SELECT,
    });
    const current = switchesOf(row);
    const before: Partial<ZaloSwitches> = {};
    const after: Partial<ZaloSwitches> = {};
    for (const key of ZALO_SWITCH_KEYS) {
      const next = partial[key];
      if (typeof next === "boolean" && next !== current[key]) {
        before[key] = current[key];
        after[key] = next;
      }
    }
    const changed = Object.keys(after) as ZaloSwitchKey[];
    if (changed.length === 0) return current;
    await tx.tournamentZalo.update({
      where: { tournamentId },
      data: Object.fromEntries(changed.map((k) => [switchColumn(k), after[k]])),
    });
    await recordAudit(tx, {
      actor: { type: "USER", userId },
      action: AUDIT_ACTIONS.ZALO_SWITCHES_CHANGED,
      entityType: "TOURNAMENT",
      entityId: tournamentId,
      tournamentId,
      before,
      after,
    });
    return { ...current, ...after };
  });
}
