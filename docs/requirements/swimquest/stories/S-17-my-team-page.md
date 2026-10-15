# S-17: My Team page with roster and contributions

- **Priority:** P0
- **Covers:** FR-52, FR-36 · **Decisions:** Q-31
- **Depends on stories:** S-07, S-13

## User story
As a team member, I want to see my team, its members and what each has contributed, so that we can cheer each other on.

## Acceptance criteria
1. **Way in**
   - Given I am in a team
   - When I open the My Team tab (or land there after joining)
   - Then I see the team's name, emblem, description, captain, start, progress % and team points
2. **Roster with contributions**
   - Given my team has members
   - When I view the roster
   - Then each member is listed with display name, verified km and points in this tournament
3. **Teammates always visible**
   - Given a teammate set their profile fields to private
   - When I view the roster
   - Then I still see their verified contribution to the team
4. **Members count**
   - Given my team has a member limit
   - When I view the page
   - Then I see "members / limit"
5. **Not in a team**
   - Given I am in no team
   - When I open My Team
   - Then I see an empty state explaining how to join a tournament

## Out of scope
- Captain tools (S-35, S-36, S-40, S-41); team collectibles (S-83); levels on the roster (S-51).
