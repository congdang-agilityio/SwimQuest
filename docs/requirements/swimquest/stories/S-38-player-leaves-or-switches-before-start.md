# S-38: Player leaves or switches team before the start; blocked after

- **Priority:** P1
- **Covers:** FR-28, FR-34, FR-36 · **Decisions:** Q-50, Q-53
- **Depends on stories:** S-10, S-17

## User story
As a player, I want to leave my team or switch to another one before the season starts, so that I can fix a wrong choice in time.

## Acceptance criteria
1. **Switch before the start**
   - Given the season has not started
   - When I choose "Switch team" on My Team and pick another team with room
   - Then I leave my old team and join the new one at once
2. **Leave before the start**
   - Given the season has not started
   - When I choose "Leave team" and confirm
   - Then I am no longer in a team and can choose a team with room later through the tournament page or link
3. **Blocked after the start**
   - Given the season has started
   - When I open My Team
   - Then "Switch team" and "Leave team" are not offered, a note explains that only the organizer can move players, and the server refuses such requests
4. **Captain leaving**
   - Given I am my team's captain and the season has not started
   - When I leave or switch
   - Then I am warned first, and after confirming the team has no captain until the organizer appoints one
5. **One team only**
   - Given I switch teams
   - When the switch completes
   - Then I am in exactly one team of the tournament

## Out of scope
- Organizer moves (S-39); removals (S-41).

## Notes
- AC 4: a captain who leaves or switches leaves the team without a captain until the organizer appoints one (S-08); confirmed by the stakeholder at GATE 2 (2026-10-15, "đúng", correct).
