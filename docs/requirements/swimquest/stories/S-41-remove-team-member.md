# S-41: Remove a team member before or after the start

- **Priority:** P1
- **Covers:** FR-35, FR-34, FR-55 · **Decisions:** Q-46, Q-53
- **Depends on stories:** S-17, S-10

## User story
As a team captain or organizer, I want to remove a member from a team, so that the team is not held back by someone who should not be in it.

## Acceptance criteria
1. **Remove before the start**
   - Given the season has not started and I am the team's captain or the organizer
   - When I choose "Remove" on a member and confirm
   - Then the player is no longer in the team, stays in the tournament without a team, and can choose another team with room
2. **Remove after the start**
   - Given the season has started
   - When I remove a member and confirm
   - Then the player leaves the tournament; the swims they made stay with the team with their points, so team progress does not change
3. **No rejoining through the link**
   - Given a player was removed after the start
   - When they open the tournament's invite link
   - Then they cannot join; swims they upload afterwards do not count in this tournament
4. **Removed player informed**
   - Given I was removed
   - When I open the app
   - Then I see that I was removed from the team (and, after the start, from the tournament)
5. **Audited, members cannot remove**
   - Given a removal happened
   - When the audit trail is checked
   - Then it records who removed whom and when; a member who is not captain or organizer cannot remove anyone

## Out of scope
- Organizer adding a removed player back (S-42).

## Notes
- A-19, A-23, BR-37.
