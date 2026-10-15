# S-20: First-swim and long-swim bonuses

- **Priority:** P1
- **Covers:** FR-49 · **Decisions:** Q-43, Q-48
- **Depends on stories:** S-13

## User story
As a player, I want bonus points for my first swim and for long swims, so that starting and swimming further are rewarded.

## Acceptance criteria
1. **First-swim bonus**
   - Given I have no verified swim yet in a tournament
   - When my first swim is verified there
   - Then I get +20 points once in that tournament
2. **Long-swim bonus 1,000 m**
   - Given a verified swim of 1,000 m up to 2,999 m
   - When it counts
   - Then I get +10 points
3. **Long-swim bonus 3,000 m instead**
   - Given a verified swim of 3,000 m or more
   - When it counts
   - Then I get +25 points instead of +10
4. **One long-swim bonus per day**
   - Given I already got a long-swim bonus today (Vietnam time)
   - When another long swim from the same day counts
   - Then it gives no second long-swim bonus
5. **Bonuses visible**
   - Given a swim earned bonuses
   - When I open it in My swims
   - Then I see distance points and each bonus separately

## Out of scope
- Organizer-changed bonus values (S-25); weekly multiplier (S-21).

## Notes
- Bonuses are in team points and move the ship (BR-30).
- BA reading: the long-swim distance is the swim's counted distance (after the longest-swim setting).
