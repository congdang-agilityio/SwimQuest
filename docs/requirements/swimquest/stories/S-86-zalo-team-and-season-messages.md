# S-86: Zalo: team, join, move and season start messages

- **Priority:** P2
- **Covers:** FR-83 · **Decisions:** Q-55
- **Depends on stories:** S-85

## User story
As a tournament organizer, I want the Zalo group to hear about new teams, new players, moves and the season start, so that the group follows the tournament without opening the app.

## Acceptance criteria
1. **New team**
   - Given my tournament has a linked group
   - When I create a team
   - Then the bot posts the team with a link that opens the join page with that team preselected
2. **Player joins**
   - Given a linked group
   - When a player joins a team
   - Then the bot posts the player's display name, the team and the team's size
3. **Player moved**
   - Given a linked group
   - When I move a player to another team
   - Then the bot posts the move
4. **Season start**
   - Given a linked group
   - When the season starts
   - Then the bot posts the season start
5. **Vietnamese only**
   - Given any of these messages
   - When it is posted
   - Then it is in Vietnamese, whatever language the organizer uses in the app

## Out of scope
- Swim, milestone and season-end messages (S-87, S-88).
