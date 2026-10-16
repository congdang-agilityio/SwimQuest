-- Data migration (#379): mark tournaments whose start lock time had already passed at deploy
-- as processed, so the tick emits TEAM_START_LOCKED only for locks crossed after this deploy
-- (no lock notifications for past or completed tournaments). Lock time is
-- "startChoiceDeadlineAt", else "seasonStartAt". DRAFT tournaments are left untouched.
UPDATE "Tournament"
SET "startLockProcessedAt" = CURRENT_TIMESTAMP
WHERE "startLockProcessedAt" IS NULL
  AND "status" <> 'DRAFT'
  AND COALESCE("startChoiceDeadlineAt", "seasonStartAt") <= CURRENT_TIMESTAMP;
