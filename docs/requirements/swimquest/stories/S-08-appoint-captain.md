# S-08: Organizer appoints and changes a team captain

- **Priority:** P0
- **Covers:** FR-76, FR-55, FR-09 · **Decisions:** Q-11
- **Depends on stories:** S-07

## User story
As a tournament organizer, I want to appoint a member of each team as its captain, so that every team has someone to choose its start and look after it.

## Acceptance criteria
1. **See the roster**
   - Given my tournament has teams with members
   - When I open a team from my tournament's organizer page
   - Then I see its members with their display names and who is captain, if anyone
2. **Appoint a captain**
   - Given a team has no captain
   - When I choose "Make captain" next to a member
   - Then that member is the captain, shown with a captain mark on the team page, and gets the captain functions for that team only
3. **Change the captain**
   - Given a team has a captain
   - When I make another member captain
   - Then the new member is captain and the previous one becomes a normal member
4. **Audited**
   - Given I appointed or changed a captain
   - When the audit trail is checked
   - Then it records who did it, when, the team, and the previous and new captain
5. **Only the organizer**
   - Given I am not this tournament's organizer
   - When I try to appoint a captain
   - Then the action is not offered and the server refuses it

## Out of scope
- Captain handing over captaincy (S-40).

## Notes
- The captain role is scoped to one team in one tournament (FR-09).
