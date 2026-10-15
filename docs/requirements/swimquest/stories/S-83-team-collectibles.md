# S-83: Team collectibles: map fragments and treasure chests

- **Priority:** P2
- **Covers:** FR-82 · **Decisions:** Q-16, Q-52
- **Depends on stories:** S-14, S-76

## User story
As a team member, I want map fragments and treasure chests at milestones, so that our voyage has rewards along the way.

## Acceptance criteria
1. **Map fragments**
   - Given my team's progress reaches 20%, 40%, 60% and 80%
   - When each is reached
   - Then the team gets one map fragment each, shown on My Team
2. **Voyage map completed**
   - Given my team has the four fragments and reaches Lý Sơn
   - When I open My Team
   - Then the Route 01 voyage map is shown completed
3. **Treasure chests**
   - Given my team reaches 50% and then Lý Sơn
   - When each is reached
   - Then a treasure chest appears and opens with the reward effect the first time a member sees it
4. **Removed with progress**
   - Given progress drops below a collectible's milestone
   - When progress is recalculated
   - Then that collectible is removed
5. **For collecting only**
   - Given any collectible
   - When I look at it
   - Then it has no effect on points, progress or the race, and cannot be spent

## Out of scope
- Personal collectibles (S-84).

## Notes
- Kept per tournament; shown on the team page and profile.
