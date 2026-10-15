/** FR-23 lifecycle: DRAFT -> PUBLISHED -> ACTIVE -> COMPLETED -> ARCHIVED. */
export type TournamentStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type LifecycleTournament = {
  status: TournamentStatus;
  seasonStartAt: Date;
  seasonEndAt: Date;
  startChoiceDeadlineAt: Date | null;
};

/** Status derived from time: a PUBLISHED tournament is ACTIVE from seasonStartAt (inclusive). */
export function effectiveStatus(t: LifecycleTournament, now: Date): TournamentStatus {
  if (t.status === "PUBLISHED" && now.getTime() >= t.seasonStartAt.getTime()) return "ACTIVE";
  return t.status;
}

export function startLockAt(t: LifecycleTournament): Date {
  return t.startChoiceDeadlineAt ?? t.seasonStartAt;
}

/** Locked from startLockAt (inclusive); fails closed (locked) when a date is invalid. */
export function isStartLocked(t: LifecycleTournament, now: Date): boolean {
  return !(now.getTime() < startLockAt(t).getTime());
}

/** BR-33: joining is open while PUBLISHED or ACTIVE and before the season end. */
export function isJoiningOpen(t: LifecycleTournament, now: Date): boolean {
  const status = effectiveStatus(t, now);
  return (status === "PUBLISHED" || status === "ACTIVE") && now.getTime() < t.seasonEndAt.getTime();
}

/** Purely time-based (status is ignored): editable only before seasonStartAt. */
export function isRouteEditable(t: LifecycleTournament, now: Date): boolean {
  return now.getTime() < t.seasonStartAt.getTime();
}
