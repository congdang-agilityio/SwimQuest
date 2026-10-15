# S-14: The team's ship moves along the Route 01 map

- **Priority:** P0
- **Covers:** FR-41, FR-43, FR-37 · **Decisions:** Q-06, Q-43, Q-48
- **Depends on stories:** S-13, S-09, S-18

## User story
As a player, I want to see my team's ship move along the map as we earn points, so that I can follow our voyage to Lý Sơn.

## Acceptance criteria
1. **Way in and map content**
   - Given I am in a team
   - When I open the Voyage tab
   - Then I see the Route 01 map with the seven destinations, my team's start, the path to Lý Sơn and my team's ship
2. **Progress from points**
   - Given a 100 km route with 10 points per km and my team has 680 points
   - When I view Voyage
   - Then the ship is at 68% of the path and the label reads "68 / 100 route km · 68%"
3. **Capped at Lý Sơn**
   - Given my team's points are above the route length in points
   - When I view Voyage
   - Then progress shows 100% and the ship stays at Lý Sơn
4. **Updates after a swim**
   - Given a teammate's swim is verified
   - When I open or refresh Voyage
   - Then the ship's position and label include the new points
5. **Illustrative map, readable labels**
   - Given I view the map
   - When I read the destination names and progress
   - Then they are text layers (not part of the picture) in the current language, and a note says the map is illustrative and not a navigation chart

## Out of scope
- Finish experience at 100% (S-19); ship tiers (S-52); other teams' ships (leaderboard S-15).

## Notes
- progress % = min(100, team points ÷ (route km × points per km) × 100), rounded only for display (FR-41).
- Before a start is chosen the map shows "start not chosen yet" and no path.
