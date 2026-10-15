# S-15: Team leaderboard: Progress tab

- **Priority:** P0
- **Covers:** FR-50 · **Decisions:** Q-26, GATE 2 tie order (2026-10-15)
- **Depends on stories:** S-14

## User story
As a player, I want to see how all teams in my tournament are doing on the route, so that I know where my team stands.

## Acceptance criteria
1. **Way in**
   - Given I am in a tournament
   - When I choose "Leaderboard" on the Voyage tab or the tournament page
   - Then the tournament's leaderboard opens on the "Progress" tab
2. **Ranking by progress**
   - Given several teams have progress
   - When I view the Progress tab
   - Then teams are listed from highest to lowest progress %, each with emblem, name, progress % and route km
3. **Ties**
   - Given two teams have the same progress % (below 100% or both at 100%)
   - When I view the Progress tab
   - Then the team that reached that progress first is ranked higher (at 100%: the team that reached Lý Sơn first)
4. **My team highlighted**
   - Given I am in one of the teams
   - When I view the leaderboard
   - Then my team's row is highlighted by more than colour alone
5. **Clear label**
   - Given I view the Progress tab
   - When I read its header
   - Then it states that it ranks route progress from team points

## Out of scope
- Points, Total km and Badges tabs (S-22).

## Notes
- Tie rule per FR-50 ("ties broken by who reached it first"), confirmed for teams below 100% by the stakeholder at GATE 2 (2026-10-15): "đội đạt được tiến độ trước" (the team that reached that progress first ranks higher). "Reached that progress" = the moment the team's points first reached the tied value. At 100% the finish time applies (A-18; a withdrawn and regained finish uses the new time).
