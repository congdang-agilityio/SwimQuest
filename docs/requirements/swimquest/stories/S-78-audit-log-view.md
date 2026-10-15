# S-78: Audit log view for platform admins

- **Priority:** P2
- **Covers:** FR-55, NFR-09 · **Decisions:** Q-01
- **Depends on stories:** S-62

## User story
As a platform admin, I want to read the audit trail, so that I can check who changed what and why.

## Acceptance criteria
1. **Way in**
   - Given I am a platform admin
   - When I open "Audit log" in the admin area
   - Then I see audit events newest first with actor, action, target, time and reason
2. **Filter**
   - Given many events
   - When I filter by tournament, user, action type or date range
   - Then only matching events are shown
3. **Details**
   - Given an event
   - When I open it
   - Then I see its old and new values
4. **Read only**
   - Given the audit log
   - When anyone tries to change or delete an event
   - Then it is not possible
5. **Covers all audited actions**
   - Given verification decisions, score changes, admin overrides, captain changes, team moves, account state changes and admin role changes happened
   - When I look at the log
   - Then each of them is there

## Out of scope
- Organizer-facing audit views (not required).

## Notes
- Connection changes (FR-55) apply once external connections are built (later release).
