# S-45: Organizer appoints review helpers

- **Priority:** P1
- **Covers:** FR-71, FR-09, FR-55 · **Decisions:** Q-35
- **Depends on stories:** S-43

## User story
As a tournament organizer, I want to appoint helpers who can review swims in my tournament, so that I do not have to review everything alone.

## Acceptance criteria
1. **Appoint**
   - Given I am the organizer
   - When I open "Review helpers" on the organizer page and choose a player who is in my tournament
   - Then that player becomes a review helper for my tournament
2. **Helper's access**
   - Given I am a review helper of a tournament
   - When I open the app
   - Then I see that tournament's review queue (from Home or the tournament page) and can decide flagged swims and disputes there
3. **Only that tournament**
   - Given I am a helper of one tournament
   - When I try to review in another tournament
   - Then it is not offered and the server refuses it
4. **Remove**
   - Given a helper
   - When I remove them
   - Then they lose access to the queue at once
5. **Audited**
   - Given helpers were appointed or removed or made decisions
   - When the audit trail is checked
   - Then each is recorded

## Out of scope
- Other organizer powers: helpers cannot edit the tournament or teams.

## Notes
- BA reading: helpers are chosen among the tournament's players (the requirements say "player appointed by an organizer").
