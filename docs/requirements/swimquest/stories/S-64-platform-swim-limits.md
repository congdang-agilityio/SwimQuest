# S-64: Admin sets the default realistic swim limits and their sanity bounds

- **Priority:** P1
- **Covers:** FR-85, FR-54, FR-55 · **Decisions:** Q-56
- **Depends on stories:** S-62, S-12

## User story
As a platform admin, I want to set the default realistic swim limits that new tournaments start with, and the sanity bounds organizers must stay inside, so that every tournament flags impossible swims without organizers setting absurd limits.

## Acceptance criteria
1. **Way in**
   - Given I am a platform admin
   - When I open "Swim limits" in the admin area
   - Then I see the default fastest pace and slowest pace (time per 100 m) and longest realistic swim (km), starting at 1:05, 5:00 and 30 km, and for each the sanity bounds (lowest and highest value an organizer may set)
2. **Change the defaults**
   - Given I enter new valid defaults and a reason and save
   - When an organizer creates a tournament afterwards
   - Then its realistic swim limits are pre-filled with the new defaults; tournaments created before keep their values (A-29)
3. **Change the bounds**
   - Given I enter new valid bounds and a reason and save
   - When a tournament created afterwards has its realistic swim limits checked (when the organizer sets them, S-93, and at publishing, S-06)
   - Then values outside the new bounds are not accepted; tournaments created before keep their limits and their already decided swims keep their status (A-29)
4. **Invalid values refused**
   - Given I enter a default outside its bounds, a lowest bound above the highest, or a default fastest pace that is not faster than the default slowest pace
   - When I try to save
   - Then nothing is saved and I see what to fix
5. **Audited**
   - Given defaults or bounds changed
   - When the audit trail is checked
   - Then it records who, old and new values, reason and time

## Out of scope
- The organizer setting a tournament's own realistic swim limits (S-93); applying them to swims (S-12); organizer extra rules (S-26).

## Notes
- The starting defaults (1:05 and 5:00 per 100 m, 30 km) come from Q-56 c. The starting bound values are not in the requirements: a platform admin enters them (A-29) before organizers change limits in S-93 (which depends on this story).
- Changing defaults or bounds never changes an existing tournament's limits (A-29, FR-85).
