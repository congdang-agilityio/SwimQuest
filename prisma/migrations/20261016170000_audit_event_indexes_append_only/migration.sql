-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tournamentId_createdAt_idx" ON "AuditEvent"("tournamentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- Append-only audit events (hand-written).
-- Every DELETE and every UPDATE is rejected, except the update made by the foreign key
-- "ON DELETE SET NULL" when an actor user is deleted: it only sets "actorUserId" to NULL.
CREATE FUNCTION audit_event_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."actorUserId" IS NOT NULL
    AND NEW."actorUserId" IS NULL
    AND (to_jsonb(NEW) - 'actorUserId') = (to_jsonb(OLD) - 'actorUserId')
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'AuditEvent is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_event_append_only
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION audit_event_append_only();
