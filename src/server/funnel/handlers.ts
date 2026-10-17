import type { SwimResultStatus } from "@prisma/client";
import type { EventHandler } from "../events/handlers";
import type { DomainEventType } from "../events/types";
import { recordFunnelEvent } from "./record";

const FAILED: ReadonlySet<SwimResultStatus> = new Set(["REJECTED", "DUPLICATE", "RULE_MISSED"]);

/**
 * Domain event -> funnel event mapping (S-81 AC 1). Runs in the emitter's transaction, so a
 * rolled-back action leaves no funnel row. Ids and labels only.
 */
export const funnelHandlers: { [T in DomainEventType]?: EventHandler<T> } = {
  TEAM_JOINED: (tx, p) =>
    recordFunnelEvent(tx, "tournament_joined", {
      userId: p.userId,
      tournamentId: p.tournamentId,
      refId: p.teamId,
      props: { source: "self" },
      once: `${p.userId}:${p.tournamentId}`,
    }),
  PLAYER_ADDED_TO_TEAM: (tx, p) =>
    recordFunnelEvent(tx, "tournament_joined", {
      userId: p.userId,
      tournamentId: p.tournamentId,
      refId: p.teamId,
      props: { source: "organizer" },
      once: `${p.userId}:${p.tournamentId}`,
    }),
  TEAM_CREATED: (tx, p) =>
    recordFunnelEvent(tx, "team_created", {
      userId: p.createdBy,
      tournamentId: p.tournamentId,
      refId: p.teamId,
      once: p.teamId,
    }),
  TEAM_START_SET: (tx, p) =>
    recordFunnelEvent(tx, "route_start_selected", {
      userId: p.setBy,
      tournamentId: p.tournamentId,
      refId: p.teamId,
      props: { startId: p.startId },
    }),
  TEAM_START_LOCKED: (tx, p) =>
    recordFunnelEvent(tx, "route_start_locked", {
      tournamentId: p.tournamentId,
      refId: p.teamId,
      props: { startId: p.startId },
      once: p.teamId,
    }),
  SWIM_RESULT_CHANGED: async (tx, p) => {
    if (p.status === p.previousStatus) return;
    const name =
      p.status === "VERIFIED"
        ? "activity_verification_passed"
        : FAILED.has(p.status)
          ? "activity_verification_failed"
          : null;
    if (!name) return;
    await recordFunnelEvent(tx, name, {
      userId: p.userId,
      tournamentId: p.tournamentId,
      refId: p.resultId,
      props: { status: p.status },
      once: p.resultId,
    });
  },
  TEAM_PROGRESS_CHANGED: (tx, p) =>
    recordFunnelEvent(tx, "route_progress_changed", {
      tournamentId: p.tournamentId,
      refId: p.teamId,
      props: { fromBp: p.fromBp, toBp: p.toBp },
    }),
  TEAM_FINISHED: (tx, p) =>
    recordFunnelEvent(tx, "route_finish_reached", {
      tournamentId: p.tournamentId,
      refId: p.teamId,
      once: p.teamId,
    }),
};
