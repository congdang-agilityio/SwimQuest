# S-42: Organizer adds a player to a team

- **Priority:** P1
- **Covers:** FR-75, FR-35, FR-55 · **Decisions:** Q-12, Q-53
- **Depends on stories:** S-41

## User story
As a tournament organizer, I want to put a player into a team with room, also during the season, so that players without a team or removed players can take part again.

## Acceptance criteria
1. **Way in**
   - Given I am the organizer
   - When I open "Players without a team" on the organizer page
   - Then I see tournament players without a team and players removed after the start
2. **Add to a team**
   - Given I choose a player, pick a team with room and confirm
   - When the action completes
   - Then the player is in that team, also if the season has started
3. **Removed player comes back**
   - Given a player removed after the start is added back
   - When their swims are counted
   - Then swims they upload from now count; swims uploaded while removed do not
4. **Full team**
   - Given the team has no room
   - When I try to add a player
   - Then it is refused
5. **Audited**
   - Given I added a player
   - When the audit trail is checked
   - Then it is recorded

## Out of scope
- Inviting new people by link (S-07, S-35).

## Notes
- A-23. BA reading: "add new players during the season" (FR-75) means placing players who are already in the tournament or were removed; new people join by link.
