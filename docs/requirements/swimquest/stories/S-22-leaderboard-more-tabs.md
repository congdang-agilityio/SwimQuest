# S-22: Leaderboard: Points, Total km and Badges tabs

- **Priority:** P1
- **Covers:** FR-50, FR-49 · **Decisions:** Q-26
- **Depends on stories:** S-15

## User story
As a player, I want to compare teams by points, kilometres and badges, so that teams that keep swimming after the finish are recognised too.

## Acceptance criteria
1. **Tabs**
   - Given I open the leaderboard (S-15)
   - When I look at the tabs
   - Then I see Progress, Points, Total km and Badges, each labelled with what it ranks
2. **Points tab**
   - Given some teams have finished
   - When I open Points
   - Then teams are ranked by team points, which keep counting after the finish
3. **Total km tab**
   - Given teams have verified swims
   - When I open Total km
   - Then teams are ranked by verified km that count in the tournament (after its limits), without bonuses or multipliers
4. **Badges tab**
   - Given team members earned badges in this tournament
   - When I open Badges
   - Then teams are ranked by the number of badges earned in this tournament by their current members
5. **Score domains not mixed**
   - Given any tab
   - When I read its values
   - Then points, km and badge counts are never shown in place of each other

## Out of scope
- Badge awarding (S-48 to S-50).

## Notes
- Tab meanings per A-21.
