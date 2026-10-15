# S-31: Find public tournaments with search and filter

- **Priority:** P1
- **Covers:** FR-27, FR-28 · **Decisions:** Q-21
- **Depends on stories:** S-30, S-28

## User story
As a player, I want to browse and search public tournaments, so that I can find one to join without an invite link.

## Acceptance criteria
1. **Way in**
   - Given I am signed in
   - When I open the Tournaments tab and choose "Find tournaments"
   - Then I see public tournaments that are published or active, with name, dates, status and free places
2. **Search**
   - Given I type part of a tournament name
   - When the search runs
   - Then only matching public tournaments are shown
3. **Filter by status**
   - Given I choose a status filter (published, active, completed)
   - When the list updates
   - Then only tournaments in that status are shown
4. **Never lists hidden tournaments**
   - Given a tournament is "Invite link only" or a draft
   - When anyone who is not a member searches
   - Then it never appears
5. **Empty result**
   - Given nothing matches
   - When the list is shown
   - Then I see an empty state with a hint to clear the filters

## Out of scope
- The details page (S-28) and joining (S-07).
