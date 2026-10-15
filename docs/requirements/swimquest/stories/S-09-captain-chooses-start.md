# S-09: Captain chooses the team's Route 01 start

- **Priority:** P0
- **Covers:** FR-38, FR-37, FR-40 · **Decisions:** Q-06, Q-11, Q-46, Q-57
- **Depends on stories:** S-08

## User story
As a team captain, I want to choose which beach my team starts from, so that our voyage to Lý Sơn begins where we like.

## Acceptance criteria
1. **Way in**
   - Given I am the captain and my team has no start yet, before the lock
   - When I open My Team
   - Then I see a "Choose start" button that opens the start selection screen, and the start-choice deadline (date and time) with a note that a start is assigned automatically if none is chosen by then (S-94)
2. **Six starts, Lý Sơn is the finish**
   - Given I am on the start selection screen
   - When I look at the destinations
   - Then I can pick one of Bãi biển Non Nước, Bãi Sơn Thủy, Bãi Phạm Văn Đồng, Bãi Mân Thái, Hòn Sụp, Cù Lao Chàm; Lý Sơn is shown as the finish and cannot be picked; every start shows the same route distance
3. **Confirm**
   - Given I picked a start
   - When I confirm it
   - Then my team's start is saved, I see a confirmation with the lock date and time, and every team member sees the start on My Team and Voyage
4. **Change before the lock**
   - Given my team has a start and the lock has not passed
   - When I choose a different start and confirm
   - Then the new start replaces the old one
5. **Members cannot choose**
   - Given I am a team member but not the captain
   - When I open My Team
   - Then I see the team's start (or "not chosen yet") but cannot choose or change it, and the server refuses it

## Out of scope
- The lock (S-10); automatic assignment when no start is chosen (S-94); organizer override (S-37).

## Notes
- Choosing the same start again changes nothing and is harmless (FR-39).
- The start only changes scenery and the path drawn on the map (BR-17).
