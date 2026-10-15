# S-16: My swims: history with status per tournament

- **Priority:** P0
- **Covers:** FR-15, FR-48, FR-30, FR-45 · **Decisions:** Q-09, Q-41, Q-42
- **Depends on stories:** S-12

## User story
As a player, I want a list of my swims with their status in each tournament, so that I know which ones counted and why.

## Acceptance criteria
1. **Way in**
   - Given I am signed in
   - When I choose "My swims" on the Profile tab, or open a swim from Home after uploading
   - Then I see my swims, newest first, with date, distance and duration
2. **Status per tournament**
   - Given a swim belongs to two tournaments
   - When I open it
   - Then I see a separate status for each tournament (verified, flagged / waiting for review, rejected, duplicate, disputed, revoked, or "did not count: rule missed") and the points it gave there
3. **Reasons**
   - Given a swim did not count somewhere
   - When I open it
   - Then I see the reason in plain words
4. **Pagination**
   - Given I have more swims than fit on one page
   - When I scroll or choose "More"
   - Then older swims load without losing my place
5. **Only I see it**
   - Given another player
   - When they try to open my swim history
   - Then it is not available to them

## Out of scope
- Raising a dispute from a swim (S-44).

## Notes
- Teammates still see my verified contribution on the team page (S-17, Q-31).
