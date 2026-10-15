# S-87: Zalo: counted swim messages

- **Priority:** P2
- **Covers:** FR-83 · **Decisions:** Q-55
- **Depends on stories:** S-85, S-13

## User story
As a tournament organizer, I want the Zalo group to see every counted swim, so that players cheer each other on.

## Acceptance criteria
1. **Counted swim posted**
   - Given my tournament has a linked group
   - When a swim counts in my tournament
   - Then the bot posts who swam, distance, time, pace, points and the team's progress
2. **Not counted, not posted**
   - Given a swim is flagged, rejected, duplicate or misses a rule
   - When it is checked
   - Then nothing is posted for it
3. **Several tournaments, same group**
   - Given a swim counts in two tournaments that post to the same group
   - When it is posted
   - Then one message is sent with a part for each tournament
4. **Approved later**
   - Given a flagged swim is approved in review
   - When it starts to count
   - Then it is posted then
5. **Vietnamese**
   - Given any swim message
   - When posted
   - Then it is in Vietnamese and uses metric units

## Out of scope
- Switching this kind off (S-89).

## Notes
- These messages are outside players' privacy settings (R-18); players are told (S-89, A-24).
