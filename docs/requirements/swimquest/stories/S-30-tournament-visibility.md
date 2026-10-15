# S-30: Choose "Public" or "Invite link only"

- **Priority:** P1
- **Covers:** FR-25 · **Decisions:** Q-21, Q-49
- **Depends on stories:** S-06

## User story
As a tournament organizer, I want to choose whether my tournament is listed publicly or reachable only by its invite link, so that I control who finds it.

## Acceptance criteria
1. **Choice when creating or editing**
   - Given I create or edit my tournament
   - When I reach the "Visibility" field
   - Then I can choose "Public" or "Invite link only", with a one-line explanation of each
2. **Invite link only**
   - Given my tournament is "Invite link only"
   - When a player who is not a member browses or searches tournaments
   - Then it is not listed and its details are reachable only through the invite link
3. **Public**
   - Given my tournament is "Public" and published
   - When a signed-in player opens it from the tournament list
   - Then they can choose a team with room and join at once (S-07)
4. **No approval either way**
   - Given either visibility
   - When a player chooses a team with room
   - Then nobody has to approve the join
5. **Change later**
   - Given my tournament is published
   - When I switch its visibility
   - Then the listing changes at once; existing members are not affected

## Out of scope
- The public list and search (S-31).

## Notes
- Visibility is not part of the season configuration locked by FR-24, so it may be changed after publishing; confirmed by the stakeholder at GATE 2 (2026-10-15, "đúng", correct).
- No default is specified; the field must be chosen before publishing. Tournaments published before this story is built behave as "Invite link only" (S-06, S-07).
