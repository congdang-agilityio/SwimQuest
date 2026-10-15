# S-72: Admin handles reports and exceptional corrections

- **Priority:** P1
- **Covers:** FR-54, FR-39, FR-55, FR-47 · **Decisions:** Q-01
- **Depends on stories:** S-71, S-46

## User story
As a platform admin, I want to handle reports and make exceptional corrections with a recorded reason, so that problems are fixed without hiding what changed.

## Acceptance criteria
1. **Reports queue**
   - Given reports were sent
   - When I open "Reports" in the admin area
   - Then I see each report with what was reported, by whom, when and its status
2. **Close a report**
   - Given a report
   - When I mark it handled or dismissed with a note
   - Then its status changes and the note stays internal
3. **Correct a locked start**
   - Given a team's start is locked
   - When I change it as an exceptional correction with a reason
   - Then the team's start changes and the old and new values are recorded
4. **Revoke a swim as admin**
   - Given a verified swim in any tournament
   - When I revoke it with a reason
   - Then it is reversed as in S-46
5. **Every override audited, no silent rewrite**
   - Given I made any override
   - When the audit trail is checked
   - Then it records actor, reason, time, old and new values, and scoring history keeps the earlier entries

## Out of scope
- Suspending accounts (S-63); audit log view (S-78).
