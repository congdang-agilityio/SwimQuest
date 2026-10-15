# S-06: Publish a tournament and get its invite link

- **Priority:** P0
- **Covers:** FR-22, FR-23, FR-80 · **Decisions:** Q-22, Q-25, Q-45, Q-06, Q-56, Q-58
- **Depends on stories:** S-05

## User story
As a tournament organizer, I want to check, preview and publish my tournament and get one invite link, so that players can join it.

## Acceptance criteria
1. **Validation before publishing**
   - Given my draft is missing something required (season end not after season start, compared as date and time; realistic swim limits outside the platform's sanity bounds; no route; no route distance or not above zero; no team)
   - When I choose "Publish"
   - Then it is not published and I see a list of what to fix, each item linking to the field
2. **Preview**
   - Given my draft is valid
   - When I choose "Preview"
   - Then I see the tournament as players will see it (name, description, season start and end dates and times, route, route distance, teams with free places)
3. **Publish**
   - Given my draft is valid
   - When I confirm "Publish"
   - Then the tournament moves to PUBLISHED, joining is open, and the organizer page shows its status
4. **Invite link**
   - Given my tournament is published
   - When I open its organizer page
   - Then I see the tournament's single invite link with a "Copy" button and the phone's share option
5. **Publishing twice is harmless**
   - Given I press "Publish" twice quickly or retry after a network error
   - When the requests reach the server
   - Then the tournament is published once and only one invite link exists

## Out of scope
- Switching the link off or replacing it (S-34); visibility "Public" (S-30); captain links with a preselected team (S-35).

## Notes
- Exactly one finish (Lý Sơn) is always true for Route 01 (FR-22, BR-01).
- "At least one team" to publish is A-17.
- Realistic swim limits are pre-filled from the platform defaults (S-04, S-12) and changed in S-93; the bounds check here applies with the bounds that held when the tournament was created (A-29, S-64).
- Lifecycle: DRAFT → PUBLISHED → ACTIVE (S-10) → COMPLETED → ARCHIVED (S-33).
