/** FR-23 lifecycle: DRAFT -> PUBLISHED -> ACTIVE -> COMPLETED -> ARCHIVED. */
export type TournamentStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type LifecycleTournament = {
  status: TournamentStatus;
  seasonStartAt: Date;
  seasonEndAt: Date;
  startChoiceDeadlineAt: Date | null;
  /** Days after seasonEndAt during which late uploads are still accepted (default 3). */
  lateUploadDays?: number;
};

/** Status derived from time: a PUBLISHED tournament is ACTIVE from seasonStartAt (inclusive). */
export function effectiveStatus(t: LifecycleTournament, now: Date): TournamentStatus {
  if (t.status === "ARCHIVED") return "ARCHIVED";
  if (t.status === "DRAFT") return "DRAFT";
  if (now.getTime() >= t.seasonEndAt.getTime()) return "COMPLETED";
  if (t.status === "PUBLISHED" && now.getTime() >= t.seasonStartAt.getTime()) return "ACTIVE";
  return t.status;
}

/** End of the late-upload window: seasonEndAt + lateUploadDays. */
export function uploadWindowEndsAt(t: LifecycleTournament): Date {
  return new Date(t.seasonEndAt.getTime() + (t.lateUploadDays ?? 3) * 86_400_000);
}

/** Results are final from the end of the upload window (inclusive). */
export function isResultsFinal(t: LifecycleTournament, now: Date): boolean {
  return now.getTime() >= uploadWindowEndsAt(t).getTime();
}

/** A tournament can be archived only once it is COMPLETED. */
export function isArchivable(t: LifecycleTournament, now: Date): boolean {
  return effectiveStatus(t, now) === "COMPLETED";
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
