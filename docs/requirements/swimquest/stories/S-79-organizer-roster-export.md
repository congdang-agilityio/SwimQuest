# S-79: Organizer exports the tournament roster and results

- **Priority:** P2
- **Covers:** FR-29, NFR-05, NFR-06 · **Decisions:** Q-01
- **Depends on stories:** S-65

## User story
As a tournament organizer, I want to export my tournament's teams and results, so that I can share or archive them outside the app.

## Acceptance criteria
1. **Way in**
   - Given I am the organizer
   - When I choose "Export" in the organizer console
   - Then I can download a file of teams, members and their verified km and points
2. **Privacy-controlled**
   - Given the export
   - When I open it
   - Then it contains display names but no email addresses, GPS data or moderation notes
3. **Only my tournament**
   - Given I am not this tournament's organizer
   - When I try to export it
   - Then it is refused
4. **Current values**
   - Given swims were revoked or players moved
   - When I export
   - Then the file reflects the current values
5. **Audited**
   - Given I exported
   - When the audit trail is checked
   - Then the export is recorded

## Out of scope
- Players' personal data export (deferred, Q-18).

## Notes
- BA reading: the file format is a common spreadsheet format; the Team Lead decides.
