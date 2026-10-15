# S-21: Weekly consistency multiplier

- **Priority:** P1
- **Covers:** FR-49 · **Decisions:** Q-43, Q-24
- **Depends on stories:** S-13

## User story
As a player, I want extra points when I swim regularly during a week, so that consistency is rewarded more than one big swim.

## Acceptance criteria
1. **Two active days**
   - Given in one Monday-to-Sunday week (Vietnam time) I had 2 active days (a verified swim of 500 m or more)
   - When the week ends
   - Then my distance points for that week are multiplied by 1.10 and the extra points are added
2. **Three or more active days**
   - Given I had 3 or more active days in the week
   - When the week ends
   - Then my distance points for that week are multiplied by 1.20
3. **Streak growth and maximum**
   - Given I had 3+ active days in each of the previous consecutive weeks
   - When this week (also 3+ days) ends
   - Then the multiplier grows by 5% per earlier consecutive 3+ week, never above 1.40
4. **Distance points only**
   - Given I earned bonuses in the week
   - When the multiplier is applied
   - Then it applies to distance points only, not to bonuses
5. **Shown to me**
   - Given my week ended with a multiplier
   - When I look at my points in the tournament
   - Then I see the week's multiplier and the extra points it gave

## Out of scope
- Recalculation after a revoked swim (S-46); organizer-changed multiplier values (S-25); the energy orb (S-84).

## Notes
- Example: weeks 1 and 2 with 3+ days → week 2 multiplier 1.25; with 3 earlier weeks → 1.35; capped at 1.40.
- Reading of FR-49, accepted by the stakeholder at GATE 2 (2026-10-15, "ok"): the streak growth applies on top of the ×1.20 of a 3+ week; a 2-day week gets ×1.10 and breaks the streak.
- The multiplier is in team points and moves the ship (BR-30).
