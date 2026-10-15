# S-37: Organizer chooses or overrides a team's start before the lock

- **Priority:** P1
- **Covers:** FR-38, FR-55, FR-84 · **Decisions:** Q-46, Q-57
- **Depends on stories:** S-09, S-94

## User story
As a tournament organizer, I want to choose or change a team's start before the lock, so that every team is ready when the season begins.

## Acceptance criteria
1. **Way in**
   - Given I am the organizer and the lock has not passed
   - When I open a team from the organizer page
   - Then I see its start (or "not chosen: a start will be assigned automatically at <deadline>") and a "Choose start" action
2. **Choose for a team**
   - Given a team has no start
   - When I choose one of the six starts and confirm
   - Then it becomes the team's start, members see it, and the team is no longer due for automatic assignment
3. **Override the captain**
   - Given the captain chose a start
   - When I choose a different start and confirm
   - Then my choice replaces the captain's
4. **Audited and team told**
   - Given I chose or changed a team's start
   - When the audit trail is checked
   - Then it records who, when, the old and new start; the team's members see who set it
5. **Not after the lock**
   - Given the lock has passed, whether the team's start was chosen or assigned automatically (S-94)
   - When I try to change the start
   - Then it is refused (only an audited exceptional correction by a platform admin is possible, S-72)

## Out of scope
- Notifications to the team (S-66); the automatic assignment itself (S-94).
