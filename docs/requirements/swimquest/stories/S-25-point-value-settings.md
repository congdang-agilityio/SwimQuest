# S-25: Tournament settings: point values

- **Priority:** P1
- **Covers:** FR-78, FR-49, FR-41 · **Decisions:** Q-44, Q-48
- **Depends on stories:** S-20, S-21

## User story
As a tournament organizer, I want to keep the platform scoring or change its numbers for my tournament, so that the season length and rewards fit my group.

## Acceptance criteria
1. **Platform values by default**
   - Given I open "Point values" in my draft's rules and settings
   - When I have changed nothing
   - Then the platform values are shown and used: 10 points per km, +20 first swim, +10 at 1,000 m, +25 at 3,000 m, multiplier ×1.10 / ×1.20, +5% per streak week, maximum ×1.40
2. **Change numbers**
   - Given I change any of these numbers (including the long-swim distances) and save
   - When swims count in my tournament
   - Then my values are used for points in my tournament only
3. **Route length follows points per km**
   - Given I change points per km
   - When progress is shown
   - Then the route length in points is route km × my points per km and the route km label stays correct
4. **Locked at season start**
   - Given my tournament's season has started
   - When I try to change point values
   - Then the change is refused and the values are shown as locked
5. **XP unaffected**
   - Given my tournament uses changed values
   - When a member earns XP from a swim
   - Then XP uses the platform values

## Out of scope
- XP and levels (S-51).

## Notes
- The settings screen explains that points move the ship, so bonuses make teams reach Lý Sơn with fewer real km (R-14).
