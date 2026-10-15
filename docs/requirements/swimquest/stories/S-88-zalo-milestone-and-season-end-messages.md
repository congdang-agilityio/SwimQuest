# S-88: Zalo: milestone and season end messages

- **Priority:** P2
- **Covers:** FR-83 · **Decisions:** Q-55
- **Depends on stories:** S-85, S-19, S-47, S-33

## User story
As a tournament organizer, I want the Zalo group to celebrate milestones and the final result, so that the whole group shares the big moments.

## Acceptance criteria
1. **Destination passed**
   - Given a linked group
   - When a team's ship passes a destination on Route 01
   - Then the bot posts the team and the destination
2. **Reached Lý Sơn**
   - Given a linked group
   - When a team reaches Lý Sơn
   - Then the bot posts the finish
3. **Finish lost**
   - Given a linked group
   - When a team loses its finish
   - Then the bot posts that the team is no longer at Lý Sơn
4. **Season end**
   - Given a linked group
   - When the season ends
   - Then the bot posts the season end with the final leaderboard
5. **Vietnamese**
   - Given any of these messages
   - When posted
   - Then it is in Vietnamese

## Out of scope
- Switching kinds off (S-89).

## Notes
- BA reading of AC 1: "passes a destination" means the ship reaches the position of the next destination on the team's path from its start.
