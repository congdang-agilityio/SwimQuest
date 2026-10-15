# S-39: Organizer moves a player to another team

- **Priority:** P1
- **Covers:** FR-75, FR-34, FR-41, FR-55 · **Decisions:** Q-12, Q-53, Q-13
- **Depends on stories:** S-17, S-19

## User story
As a tournament organizer, I want to move a player from one team to another, before or during the season, so that I can rebalance teams.

## Acceptance criteria
1. **Move a player**
   - Given I am the organizer
   - When I open a player in a team on the organizer page, choose "Move", pick a target team with room and confirm
   - Then the player is in the target team
2. **Swims move with the player**
   - Given the player has counted swims in this tournament
   - When the move completes
   - Then their swims, points, bonuses and multipliers count for the new team, and both teams' points and progress are recalculated
3. **Old team drops below the finish**
   - Given the old team had finished and drops below 100% because of the move
   - When progress is recalculated
   - Then the old team loses its finish (S-47)
4. **Target team full**
   - Given the target team has no room
   - When I try to move a player there
   - Then it is refused
5. **Audited**
   - Given I moved a player
   - When the audit trail is checked
   - Then it records the player, from team, to team, who moved them and when

## Out of scope
- Badges after a move (S-48, S-49): they stay with the player except Lý Sơn.

## Notes
- Allowed before and after the start (Q-53, BR-31). Risk R-13.
- If the moved player was captain of the old team, the old team has no captain until the organizer appoints one (S-08); confirmed by the stakeholder at GATE 2 (2026-10-15, "đúng", correct).
