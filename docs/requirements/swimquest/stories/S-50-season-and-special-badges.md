# S-50: Badges: Season and Special

- **Priority:** P1
- **Covers:** FR-51, FR-55 · **Decisions:** Q-15, Q-51
- **Depends on stories:** S-48, S-33

## User story
As a player, I want a badge for swimming every week of the season and the chance of a special badge from the organizer, so that loyalty and special moments are recognised.

## Acceptance criteria
1. **Season badge**
   - Given I had at least one active day in every full Monday-to-Sunday week of the season
   - When the season ends
   - Then I get the Season badge for that tournament
2. **No Season badge with a gap**
   - Given I missed one full week
   - When the season ends
   - Then I do not get the Season badge
3. **Organizer gives Special**
   - Given I am the organizer
   - When I open a player on the organizer page, choose "Give Special badge" and write a short reason
   - Then the player gets the Special badge with my reason shown
4. **Once per tournament**
   - Given a player already has the Special badge in my tournament
   - When I look at them
   - Then "Give Special badge" is not offered again
5. **Audited**
   - Given I gave a Special badge
   - When the audit trail is checked
   - Then it records who gave it, to whom, when and why

## Out of scope
- Display (S-55).
