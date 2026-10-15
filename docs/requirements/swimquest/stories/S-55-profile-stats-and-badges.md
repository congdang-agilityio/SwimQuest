# S-55: Verified stats and badges on the profile

- **Priority:** P1
- **Covers:** FR-14, FR-51 · **Decisions:** Q-04, Q-51
- **Depends on stories:** S-53, S-48

## User story
As a player, I want my profile to show my verified stats and badges from every tournament, so that I can see what I have achieved.

## Acceptance criteria
1. **Stats**
   - Given I open my profile
   - When I look at "Stats"
   - Then I see verified swims count, verified distance, active days, tournaments joined, teams, current Route 01 progress and badges count
2. **Only verified**
   - Given I have flagged or rejected swims
   - When stats are calculated
   - Then they include only verified swims
3. **Not editable**
   - Given I am editing my profile
   - When I look at stats
   - Then they cannot be edited, and the server refuses any change
4. **Badges from every tournament**
   - Given I earned badges in several tournaments
   - When I open "Badges"
   - Then I see each badge with its tournament and date
5. **Badges on the team page**
   - Given I am on My Team
   - When I view a member
   - Then I see the badges they earned in this tournament

## Out of scope
- Public view rules (S-56).
