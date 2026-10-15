# S-19: Reach Lý Sơn: finish and "HOÀN THÀNH" experience

- **Priority:** P1
- **Covers:** FR-42, FR-41 · **Decisions:** Q-13, Q-48, Q-51
- **Depends on stories:** S-14

## User story
As a team member, I want our team's arrival at Lý Sơn recorded and celebrated, so that finishing the voyage feels like a real achievement.

## Acceptance criteria
1. **Finish recorded once**
   - Given my team's points reach the route length in points
   - When the progress is updated
   - Then one finish is recorded with its time, even if several swims arrive at the same moment
2. **Finish experience**
   - Given my team has finished and I have not yet seen the celebration
   - When I next open Voyage or Home
   - Then I see the finish experience with the "HOÀN THÀNH" (Completed) emblem, my team, the route and the finish date
3. **Ship stays, points keep counting**
   - Given my team has finished
   - When members keep swimming
   - Then the ship stays at Lý Sơn, while team points and members' XP keep growing
4. **Shown on leaderboard and team page**
   - Given my team has finished
   - When anyone views the leaderboard or my team page
   - Then my team is marked as finished with its finish time
5. **Server decides the finish**
   - Given a client sends its own progress or finish value
   - When the server processes it
   - Then it is ignored; only server-calculated points decide the finish

## Out of scope
- Lý Sơn badge (S-49); withdrawing the finish (S-47); sharing (S-82).

## Notes
- The "HOÀN THÀNH" emblem is art with no embedded words other than the emblem's own design; the caption comes from the app in the current language (NFR-10).
