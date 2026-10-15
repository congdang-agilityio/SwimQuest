# S-93: Tournament settings: realistic swim limits

- **Priority:** P1
- **Covers:** FR-78, FR-68, FR-74, FR-22, FR-85 · **Decisions:** Q-56
- **Depends on stories:** S-23, S-12, S-64

## User story
As a tournament organizer, I want to set my tournament's realistic swim limits within the platform's bounds, so that the automatic checks flag swims that are impossible for my group.

## Acceptance criteria
1. **Pre-filled defaults**
   - Given I create or edit a draft and open its "Rules and settings" section
   - When I look at "Realistic swim limits"
   - Then I see fastest pace, slowest pace (time per 100 m) and longest realistic swim (km) pre-filled with the platform defaults (starting 1:05, 5:00 and 30 km), with a short explanation that a swim outside them is flagged for review and that "longest realistic swim" is separate from "longest swim counted" (S-23)
2. **Change within the bounds**
   - Given I enter values inside the platform's sanity bounds (S-64) and save
   - When a member's swim is checked for my tournament
   - Then my values are used by the automatic checks (S-12)
3. **Outside the bounds refused**
   - Given I enter a value outside the platform's sanity bounds, or a fastest pace that is not faster than the slowest pace
   - When I try to save
   - Then it is not saved and I see the allowed range
4. **Shown to players**
   - Given my tournament is published
   - When players view its details (S-28)
   - Then they see the realistic swim limits in force
5. **Locked at season start**
   - Given my tournament is active
   - When I try to change the realistic swim limits
   - Then the change is refused (S-32)

## Out of scope
- The admin setting the platform defaults and bounds (S-64); extra swim rules (S-26); publish validation (S-06).

## Notes
- The way in is the draft's "Rules and settings" section on the organizer page (S-23, S-65).
- Platform defaults or bounds changed by an admin after my tournament was created do not change my values (A-29).
- An extra rule's slowest pace must stay faster than the realistic slowest pace (BR-25, S-26).
