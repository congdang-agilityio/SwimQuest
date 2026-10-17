import type { EventHandler, EventTx } from "../events/handlers";
import type { DomainEventType } from "../events/types";
import { enqueueZalo } from "./outbox";

type Handlers = { [T in DomainEventType]?: EventHandler<T> };

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
  SEASON_STARTED: async (tx, p) => {
    await enqueueZalo(tx, {
      tournamentId: p.tournamentId,
      kind: "SEASON_START",
      payload: {},
      dedupeKey: `season-start:${p.tournamentId}`,
    });
  },
};
