# S-94: A team with no start at the deadline gets one automatically

- **Priority:** P0
- **Covers:** FR-84, FR-38, FR-39, FR-55, FR-29 · **Decisions:** Q-57
- **Depends on stories:** S-10

## User story
As a team member, I want my team to get a start automatically if nobody chose one in time, so that our ship can still sail when the season begins.

## Acceptance criteria
1. **Least-chosen start**
   - Given at the start-choice deadline 3 teams start at Bãi biển Non Nước, 2 at Hòn Sụp, 1 at each of the other four starts, and my team has none
   - When the deadline is reached
   - Then my team is given one of the four starts that only one team has (never Lý Sơn), picked at random among them
2. **Several teams without a start**
   - Given three teams have no start at the deadline and every one of the six starts has the same number of teams
   - When the deadline is reached
   - Then the three teams are assigned one at a time in random order, each assignment counting for the next, so they get three different starts (A-28)
3. **Locked like a chosen start**
   - Given my team's start was assigned automatically
   - When the captain or the organizer tries to change it
   - Then it is refused as for any locked start (S-10); only an audited exceptional correction by a platform admin can change it (S-72)
4. **Shown as "assigned automatically"**
   - Given my team's start was assigned automatically
   - When a member opens My Team or Voyage, or the organizer opens the organizer page
   - Then the start is shown with the label "assigned automatically" and the time it was assigned
5. **Audited as a system action**
   - Given a start was assigned automatically
   - When the audit trail is checked
   - Then it records the system as the actor, the tournament, the team, the start and the time

## Out of scope
- The in-app and push notification to the team's members (S-66, S-67: "team updates"); the full organizer console view (S-65); exceptional corrections (S-72).

## Notes
- Teams that already have a start (chosen by the captain or the organizer) are never changed (FR-84).
- The assignment happens at the start-choice deadline (default the season start time, S-24), in Vietnam time (NFR-20).
- Placed right after S-10 in delivery order: without it a team with no start would have no route to sail in the playable core.
