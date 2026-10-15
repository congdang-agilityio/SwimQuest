# S-26: Set extra swim rules for a tournament

- **Priority:** P1
- **Covers:** FR-72, FR-74 · **Decisions:** Q-36, Q-41, Q-56
- **Depends on stories:** S-23, S-12

## User story
As a tournament organizer, I want to add stricter swim rules such as a minimum distance and a slowest allowed pace, so that only the swims I want count in my tournament.

## Acceptance criteria
1. **Rule types offered**
   - Given I open "Extra swim rules" in my draft's rules and settings
   - When I look at the options
   - Then I can set a minimum distance per swim (meters) and a slowest allowed pace (time per 100 m), both optional and empty by default, with a short explanation that a swim missing them does not count and can only be disputed
2. **Stricter than the tournament's realistic limits**
   - Given my tournament's realistic slowest pace is 5:00 per 100 m (the pre-filled default, S-12; changeable in S-93)
   - When I enter an extra slowest allowed pace of 5:00 or slower
   - Then it is not accepted and I see the tournament's realistic slowest pace
3. **Saved and shown**
   - Given I saved extra rules
   - When players view the tournament details (S-28)
   - Then the rules are shown in plain words
4. **Locked during the season**
   - Given my tournament is active
   - When I try to change the extra rules
   - Then the change is refused
5. **Only my tournament**
   - Given I set extra rules
   - When a member's swim counts in another tournament
   - Then my rules have no effect there

## Out of scope
- Applying the rules to swims (S-27); the tournament's realistic swim limits (S-93).

## Notes
- Rule types per A-12; "slowest allowed pace" means a swim must be at least this fast (AMB-11).
- Extra rules stay separate from the realistic swim limits (FR-72, BR-38): slower than the extra rule = does not count (dispute only); slower than the realistic limit = flagged for review (S-12).
- BA reading: a minimum distance per swim is always stricter than the realistic limits (which set only a longest realistic swim), so it is accepted as long as it is above zero and below the tournament's longest realistic swim.
