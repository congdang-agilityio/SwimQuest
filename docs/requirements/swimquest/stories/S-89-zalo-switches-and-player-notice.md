# S-89: Zalo: message switches, delivery problems and player notice

- **Priority:** P2
- **Covers:** FR-83, FR-16 · **Decisions:** Q-55
- **Depends on stories:** S-86, S-87, S-88

## User story
As a tournament organizer, I want to choose which Zalo messages are sent and see delivery problems, and players should know about the group, so that the bot fits my group and nobody is surprised.

## Acceptance criteria
1. **Switches, all on by default**
   - Given my tournament has a linked group
   - When I open "Zalo group" settings
   - Then each message kind (new team, player joins, player moved, season start, counted swims, milestones, season end) has a switch, all on by default; the introduction has none and always goes out
2. **Switched off**
   - Given I switched "counted swims" off
   - When a swim counts
   - Then nothing is posted for it
3. **Delivery problems shown**
   - Given a message could not be delivered (for example the bot was removed from the group)
   - When I open the settings or console
   - Then I see the problem and when it happened
4. **Game unaffected**
   - Given Zalo delivery fails
   - When players use the app
   - Then swims, points and progress work normally
5. **Players told**
   - Given my tournament has a linked group
   - When a player views the tournament page or the join page
   - Then they see that their name and counted swims are posted to the tournament's Zalo group

## Out of scope
- Players opting out of Zalo messages individually (not required).

## Notes
- A-24, R-18.
