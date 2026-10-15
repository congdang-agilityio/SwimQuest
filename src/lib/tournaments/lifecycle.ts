export type TournamentStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | (string & {});

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

export function isStartLocked(t: LifecycleTournament, now: Date): boolean {
  return now.getTime() >= startLockAt(t).getTime();
}

/** BR-33: joining is open while PUBLISHED or ACTIVE and before the season end. */
export function isJoiningOpen(t: LifecycleTournament, now: Date): boolean {
  const status = effectiveStatus(t, now);
  return (status === "PUBLISHED" || status === "ACTIVE") && now.getTime() < t.seasonEndAt.getTime();
}

export function isRouteEditable(t: LifecycleTournament, now: Date): boolean {
  return now.getTime() < t.seasonStartAt.getTime();
}
