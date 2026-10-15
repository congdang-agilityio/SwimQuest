# S-47: Finish withdrawn when a team drops below 100%

- **Priority:** P1
- **Covers:** FR-42, FR-47 · **Decisions:** Q-13
- **Depends on stories:** S-19, S-46

## User story
As a player, I want the finish to reflect the real points, so that a team that drops below Lý Sơn is not shown as finished.

## Acceptance criteria
1. **Withdrawn**
   - Given my team finished
   - When a revoked swim or a moved player brings its progress below 100%
   - Then the finish is withdrawn and the ship moves back to its new position
2. **Lý Sơn badge removed**
   - Given the finish is withdrawn
   - When members view their badges
   - Then the Lý Sơn badge from this tournament is removed (once S-49 exists)
3. **Team told**
   - Given the finish was withdrawn
   - When members open the app
   - Then they see a message that the team is no longer at Lý Sơn and why
4. **New finish time**
   - Given the team reaches 100% again
   - When the finish is recorded
   - Then it has the new time, which is used to break ties
5. **Leaderboard reflects it**
   - Given the finish was withdrawn
   - When anyone views the leaderboard
   - Then the team is no longer marked finished

## Out of scope
- Push and Zalo messages about it (S-66, S-67, S-88).

## Notes
- BR-32, A-18.
