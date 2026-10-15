# S-27: Swims that miss an extra rule do not count in that tournament

- **Priority:** P1
- **Covers:** FR-72, FR-48, FR-30, FR-68 · **Decisions:** Q-41, Q-42, Q-56
- **Depends on stories:** S-26, S-16

## User story
As a player, I want to see clearly when my swim misses a tournament's extra rule, so that I understand why it did not count there.

## Acceptance criteria
1. **Missed rule, no review**
   - Given my tournament has a minimum distance of 800 m
   - When my verified 600 m swim is checked for it
   - Then it does not count in that tournament, is not sent to review, and has status "did not count: rule missed"
2. **Which rule**
   - Given my swim missed a rule
   - When I open it in My swims
   - Then I see which rule it missed and the swim's value, for example "minimum 800 m, your swim 600 m"
3. **Counts elsewhere**
   - Given I am also in a tournament without that rule
   - When the same swim is checked there
   - Then it counts there normally
4. **Dispute offered**
   - Given my swim missed a rule
   - When I open it
   - Then I see a "Dispute" action (S-44)
5. **Extra slowest pace vs realistic slowest pace**
   - Given my tournament's extra slowest allowed pace is 3:00 per 100 m and its realistic slowest pace is 5:00 per 100 m
   - When I upload a swim at 3:20 per 100 m, and another at 5:30 per 100 m
   - Then the 3:20 swim does not count there ("rule missed", dispute only), and the 5:30 swim is flagged for that tournament's review queue (S-12), not marked "rule missed"

## Out of scope
- Disputes (S-44); the realistic limit check itself (S-12).

## Notes
- BR-27, BR-38: missing an extra rule = does not count, dispute only; outside a realistic limit = flagged for review (Q-56 b).
