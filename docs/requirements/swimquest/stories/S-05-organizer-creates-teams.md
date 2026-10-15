# S-05: Organizer creates teams with member limits

- **Priority:** P0
- **Covers:** FR-31 · **Decisions:** Q-11, Q-45
- **Depends on stories:** S-04

## User story
As a tournament organizer, I want to create the tournament's teams, each with a member limit, so that players can be placed in balanced teams.

## Acceptance criteria
1. **Create a team**
   - Given I am on my tournament's organizer page
   - When I choose "Add team" and enter a name, choose an emblem from the available emblems, optionally write a short description, set a member limit of at least 1 and save
   - Then the team appears in the tournament's team list with its limit and "0 / limit" members
2. **Edit a team**
   - Given my tournament has a team
   - When I change its name, emblem, description or limit and save
   - Then the team shows the new values; the limit cannot be set lower than the team's current number of members
3. **Delete an empty team before publishing**
   - Given my tournament is a draft and a team has no members
   - When I delete the team
   - Then it disappears from the list
4. **Capacity shown**
   - Given my tournament has several teams
   - When I view the team list
   - Then I see the tournament capacity as the sum of the team limits
5. **Only the organizer creates teams**
   - Given I am a player who is not this tournament's organizer
   - When I view the tournament
   - Then I see no way to create or propose a team, and the server refuses such a request

## Out of scope
- Captain editing team details (S-36); appointing captains (S-08).

## Notes
- A one-person team is a team with a limit of 1; there is no solo play outside teams (A-15).
- Emblem art comes from S-74; until then simple stand-in emblems are used.
- Whether teams can be deleted after publishing is not specified; this story allows deletion only for empty teams in a draft.
