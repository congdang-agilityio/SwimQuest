# S-13: Verified swims earn distance points for the player and the team

- **Priority:** P0
- **Covers:** FR-49, FR-30, FR-78, FR-45 · **Decisions:** Q-09, Q-43, Q-44, Q-48
- **Depends on stories:** S-12

## User story
As a player, I want each verified swim to give me and my team points, so that my swimming pushes our ship forward.

## Acceptance criteria
1. **Distance points**
   - Given a swim of 2,450 m is verified in my tournament with the default settings
   - When my points are updated
   - Then I get 24 distance points (1 point per full 100 m, 10 per km)
2. **Longest swim counted**
   - Given the longest-swim setting is 10 km (default)
   - When a verified swim of 12 km counts
   - Then only 10 km counts toward distance and points
3. **Daily limit**
   - Given the daily limit is 10 km (default) and I already have 8 km counted today (Vietnam time)
   - When another verified 4 km swim from the same day counts
   - Then only 2 km and 20 distance points are added for it
4. **Team points**
   - Given my team has several members with points
   - When anyone views the team
   - Then the team's points equal the sum of its members' points in this tournament
5. **One swim, every tournament**
   - Given I am active in two tournaments on the swim's date
   - When the swim is verified in both
   - Then it counts once in each tournament, toward my team there, and each tournament shows its own status for it

## Out of scope
- First-swim and long-swim bonuses (S-20); weekly multiplier (S-21); organizer-changed limits and point values (S-23, S-25); XP (S-51).

## Notes
- Only verified swims count; pending, flagged, rejected, duplicate, disputed and revoked swims do not (BR-04).
- Points are fixed-precision and server-calculated (NFR-02, NFR-08). Score domains stay separate (BR-08).
