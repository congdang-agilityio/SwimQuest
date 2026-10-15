# S-65: Organizer console overview

- **Priority:** P1
- **Covers:** FR-29, FR-84 · **Decisions:** Q-01, Q-22, Q-57, Q-58
- **Depends on stories:** S-06, S-43, S-94

## User story
As a tournament organizer, I want one dashboard for my tournament, so that I can see its state and reach every organizer function.

## Acceptance criteria
1. **Way in**
   - Given I organize one or more tournaments
   - When I open the Tournaments tab and choose "Manage" on one of them (or open it from Home)
   - Then the organizer console opens for that tournament
2. **Status and timeline**
   - Given the console is open
   - When I look at the top
   - Then I see the status, the timeline with dates and times in Vietnam time (published, season start, start-choice lock, season end, upload window end) and publish/archive controls allowed in this state
3. **Registrations and roster**
   - Given players have joined
   - When I open "Teams and players"
   - Then I see every team with members, captain, free places and players without a team
4. **Start selection status**
   - Given the console is open
   - When I look at "Starts"
   - Then I see each team's start, which teams have none yet (they get one automatically at the lock), which starts were "assigned automatically" (S-94), and whether the choice is locked
5. **Progress and links**
   - Given the season is running
   - When I look at the console
   - Then I see each team's progress and participation (active members this week) and links to the review queue, settings, invite link and review helpers

## Out of scope
- Export (S-79); metrics and fairness view (S-80).
