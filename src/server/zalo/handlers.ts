import { destinationsPassed } from "@/lib/routes/destinations-passed";
import type { MapPoint } from "@/lib/routes/path-position";
import route01Anchors from "../../../public/art/route01/map-anchors.json";
import type { EventHandler, EventTx } from "../events/handlers";
import type { DomainEventType } from "../events/types";
import { enqueueZalo } from "./outbox";

type Handlers = { [T in DomainEventType]?: EventHandler<T> };

const anchorsByRoute: Record<string, Record<string, MapPoint>> = {
  route01: route01Anchors.anchors,
};

/**
 * The id of the latest progress drop of the team that took it back below `slug` (so the
 * destination counts as passed again on the next crossing), or "0" when there was none. Drops
 * are rare (revoked swims, moves), so the team's events are read in the game transaction.
 */
async function lastDropBelow(
  tx: EventTx,
  team: { tournamentId: string; teamId: string; routeId: string; start: string },
  anchors: Record<string, MapPoint>,
  slug: string,
): Promise<string> {
  const events = await tx.domainEvent.findMany({
    where: {
      tournamentId: team.tournamentId,
      type: "TEAM_PROGRESS_CHANGED",
      payload: { path: ["teamId"], equals: team.teamId },
    },
    select: { id: true, payload: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  for (const e of events) {
    const { fromBp, toBp } = (e.payload ?? {}) as { fromBp?: unknown; toBp?: unknown };
    if (typeof fromBp !== "number" || typeof toBp !== "number" || toBp >= fromBp) continue;
    const undone = destinationsPassed(team.routeId, anchors, team.start, toBp, fromBp);
    if (undone.some((d) => d.slug === slug)) return e.id;
  }
  return "0";
}

/** Active members and the limit of a team, read in the game transaction (sizes as of the event). */
async function teamSize(tx: EventTx, teamId: string): Promise<{ size: number; limit: number }> {
  const [size, team] = await Promise.all([
    tx.teamMember.count({ where: { teamId, status: "ACTIVE" } }),
    tx.team.findUnique({ where: { id: teamId }, select: { memberLimit: true } }),
  ]);
  return { size, limit: team?.memberLimit ?? size };
}

async function playerJoined(
  tx: EventTx,
  p: { tournamentId: string; teamId: string; userId: string },
) {
  const { size, limit } = await teamSize(tx, p.teamId);
  await enqueueZalo(tx, {
    tournamentId: p.tournamentId,
    kind: "PLAYER_JOINED",
    payload: { teamId: p.teamId, userId: p.userId, size, limit },
  });
}

/**
 * Domain events posted to the tournament's Zalo group (S-86..S-88). Each runs inside the
 * emitter's transaction and only queues (`enqueueZalo` does nothing without a linked group);
 * the text is rendered in Vietnamese when the message is sent. Payloads hold ids and numbers.
 */
export const zaloHandlers: Handlers = {
  TEAM_CREATED: async (tx, p) => {
    const t = await tx.tournament.findUnique({
      where: { id: p.tournamentId },
      select: { status: true },
    });
    // A draft's teams are set up before anyone can join: they are not news yet.
    if (!t || t.status === "DRAFT" || t.status === "ARCHIVED") return;
    await enqueueZalo(tx, {
      tournamentId: p.tournamentId,
      kind: "NEW_TEAM",
      payload: { teamId: p.teamId },
      dedupeKey: `new-team:${p.teamId}`,
    });
  },
  TEAM_JOINED: (tx, p) => playerJoined(tx, p),
  PLAYER_ADDED_TO_TEAM: (tx, p) => playerJoined(tx, p),
  TEAM_MEMBER_MOVED: async (tx, p) => {
    const [from, to] = await Promise.all([teamSize(tx, p.fromTeamId), teamSize(tx, p.teamId)]);
    await enqueueZalo(tx, {
      tournamentId: p.tournamentId,
      kind: "PLAYER_MOVED",
      payload: {
        userId: p.userId,
        fromTeamId: p.fromTeamId,
        teamId: p.teamId,
        fromSize: from.size,
        fromLimit: from.limit,
        toSize: to.size,
        toLimit: to.limit,
      },
    });
  },
  /**
   * A result that starts to count (VERIFIED at upload, or later on approval) is posted once
   * (`ZaloSwimPost`); every other status posts nothing. The results of one swim in several
   * tournaments posting to the same group merge into one message, a part per tournament.
   */
  SWIM_RESULT_CHANGED: async (tx, p) => {
    if (p.status !== "VERIFIED" || p.previousStatus === "VERIFIED") return;
    await enqueueZalo(tx, {
      tournamentId: p.tournamentId,
      kind: "COUNTED_SWIM",
      payload: {
        tournamentId: p.tournamentId,
        resultId: p.resultId,
        swimId: p.swimId,
        userId: p.userId,
      },
      groupKey: (chatId) => `swim:${p.swimId}:${chatId}`,
      swimResultId: p.resultId,
    });
  },
  /**
   * Destinations the ship passed on the team's path from its start (#378). The finish is never
   * one of them (Lý Sơn is announced by TEAM_FINISHED only). Deduped per team and destination
   * while the progress stays above it: a drop back below it starts a new key.
   */
  TEAM_PROGRESS_CHANGED: async (tx, p) => {
    if (p.toBp <= p.fromBp) return;
    const team = await tx.team.findUnique({
      where: { id: p.teamId },
      select: { startDestination: true, tournament: { select: { routeId: true } } },
    });
    const routeId = team?.tournament.routeId ?? "";
    const anchors = anchorsByRoute[routeId];
    const start = team?.startDestination;
    if (!start || !anchors) return;
    const passed = destinationsPassed(routeId, anchors, start, p.fromBp, p.toBp);
    for (const d of passed) {
      const ref = { tournamentId: p.tournamentId, teamId: p.teamId, routeId, start };
      const drop = await lastDropBelow(tx, ref, anchors, d.slug);
      await enqueueZalo(tx, {
        tournamentId: p.tournamentId,
        kind: "MILESTONE",
        payload: { milestone: "DESTINATION", teamId: p.teamId, destination: d.slug },
        dedupeKey: `milestone:${p.teamId}:${d.slug}:${drop}`,
      });
    }
  },
  /** The finish time is stored, so the message keeps it even if the finish is lost later. */
  TEAM_FINISHED: async (tx, p) => {
    const team = await tx.team.findUnique({
      where: { id: p.teamId },
      select: { finishedAt: true },
    });
    const at = team?.finishedAt;
    if (!at) return;
    await enqueueZalo(tx, {
      tournamentId: p.tournamentId,
      kind: "MILESTONE",
      payload: { milestone: "FINISH", teamId: p.teamId, finishedAt: at.getTime() },
      dedupeKey: `finish:${p.teamId}:${at.getTime()}`,
    });
  },
  TEAM_FINISH_LOST: async (tx, p) => {
    const team = await tx.team.findUnique({
      where: { id: p.teamId },
      select: { finishLostAt: true },
    });
    const at = team?.finishLostAt?.getTime() ?? 0;
    await enqueueZalo(tx, {
      tournamentId: p.tournamentId,
      kind: "MILESTONE",
      payload: { milestone: "FINISH_LOST", teamId: p.teamId },
      dedupeKey: `finish-lost:${p.teamId}:${at}`,
    });
  },
  /** The season end with the final leaderboard, once per tournament. */
  SEASON_ENDED: async (tx, p) => {
    await enqueueZalo(tx, {
      tournamentId: p.tournamentId,
      kind: "SEASON_END",
      payload: {},
      dedupeKey: `season-end:${p.tournamentId}`,
    });
  },
  SEASON_STARTED: async (tx, p) => {
    await enqueueZalo(tx, {
      tournamentId: p.tournamentId,
      kind: "SEASON_START",
      payload: {},
      dedupeKey: `season-start:${p.tournamentId}`,
    });
  },
};
