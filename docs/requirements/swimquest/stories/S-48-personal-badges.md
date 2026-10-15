# S-48: Badges: Participation, Conqueror and Perseverance

- **Priority:** P1
- **Covers:** FR-51 · **Decisions:** Q-15, Q-51
- **Depends on stories:** S-13, S-76

## User story
As a player, I want badges for my own achievements, so that my effort is recognised.

## Acceptance criteria
1. **Participation**
   - Given I have no Participation badge in a tournament
   - When my first verified swim counts there
   - Then I get the Participation badge for that tournament
2. **Conqueror**
   - Given my counted verified swims in a tournament reach 50 km in total
   - When the total is updated
   - Then I get the Conqueror badge for that tournament
3. **Perseverance**
   - Given I had 3 or more active days (verified swim ≥ 500 m) in each of 4 Monday-to-Sunday weeks in a row
   - When the fourth week ends
   - Then I get the Perseverance badge for that tournament
4. **Once per tournament, no points**
   - Given I already have a badge in a tournament
   - When its rule is met again
   - Then I do not get it twice there, and badges never add points or XP
5. **Removed when no longer met**
   - Given a revoked swim means a badge's rule is no longer met
   - When the revocation is processed
   - Then that personal badge is removed

## Out of scope
- Showing badges on the profile (S-55); team badges (S-49); Season and Special (S-50).

## Notes
- Badges stay with a player who is moved to another team (FR-51).
