# S-04: Create a tournament draft

- **Priority:** P0
- **Covers:** FR-21, FR-73, FR-40, FR-37, FR-09 · **Decisions:** Q-08, Q-10, Q-22, Q-25, Q-06, Q-58
- **Depends on stories:** S-03

## User story
As a player, I want to create a tournament with its season start and end, route and route distance, so that I can organize a swimming expedition for my group.

## Acceptance criteria
1. **Create a draft and become organizer**
   - Given I am signed in
   - When I choose "Create tournament" in the Tournaments tab or on Home and fill in name, description, season start (date and time), season end (date and time), route and route distance, then save
   - Then a tournament in the DRAFT state is saved, I am its organizer, and I land on its organizer page (the start of the organizer console, S-65)
2. **Route from a list and its distance**
   - Given I am creating a tournament
   - When I open the route choice and the route distance field
   - Then the route list contains only Route 01, shown with its seven destinations in order (Bãi biển Non Nước, Bãi Sơn Thủy, Bãi Phạm Văn Đồng, Bãi Mân Thái, Hòn Sụp, Cù Lao Chàm, Lý Sơn as the finish); the route distance field is empty, asks for kilometres, explains that every start has this same distance to Lý Sơn, and does not accept zero or a negative value
3. **Season times pre-filled**
   - Given I pick a season start date of 1 November and an end date of 30 November
   - When I look at the times
   - Then the start shows 00:00 on 1 November and the end 23:59 on 30 November, labelled as Vietnam time, and I can change either time
4. **Season end must be after season start**
   - Given I enter a season end (date and time) that is not after the season start (date and time), for example both on 1 November with the end at 06:00 and the start at 07:00
   - When I try to save
   - Then I see an error and the draft keeps my other entries
5. **Draft is private**
   - Given my tournament is a draft
   - When another player looks for it or opens its address
   - Then they cannot see it

## Out of scope
- Teams (S-05), publishing (S-06), optional fields such as banner and logo (S-29), tournament settings and rules (S-23 to S-27, S-93), visibility (S-30), Zalo (S-85), the 3-tournament limit (S-61).

## Notes
- The season start and end are a date and time in Vietnam time (Q-58, NFR-20). The tournament becomes ACTIVE at the season start time (S-10) and COMPLETED at the season end time (S-33); a swim is inside the season when its start time is inside this range (S-12).
- A new tournament also gets its realistic swim limits pre-filled from the platform defaults (FR-78 item 9; starting values 1:05 and 5:00 per 100 m and 30 km). They are used by the automatic checks from P0 (S-12); the organizer can change them in S-93.
- Each start shows the same distance; the start only changes scenery and the path on the map (BR-17).
- Routes must be addable later without changing existing tournaments (FR-73).
