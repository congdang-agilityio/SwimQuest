# S-23: Tournament settings: longest swim, daily limit and swim type

- **Priority:** P1
- **Covers:** FR-78, FR-74, FR-24 · **Decisions:** Q-44, Q-48, Q-37
- **Depends on stories:** S-13

## User story
As a tournament organizer, I want to set the longest swim counted, the daily limit and which swim types count, so that the tournament suits my group.

## Acceptance criteria
1. **Defaults shown**
   - Given I create or edit a draft and open its "Rules and settings" section
   - When I look at these settings
   - Then I see longest swim counted 10 km, daily limit per player 10 km, swim type "pool and open water", each with a short explanation
2. **Change values**
   - Given I enter a different longest swim or daily limit (greater than zero) and save
   - When swims are counted in my tournament
   - Then the new values are used instead of the defaults
3. **Swim type restriction**
   - Given I set swim type to "open water only" (or "pool only")
   - When a verified swim of the other type is uploaded by a member
   - Then it does not count in my tournament, without review, and the player sees "did not count: swim type" and may dispute (S-44)
4. **Shown to players**
   - Given my tournament is published
   - When players view its details (S-28)
   - Then they see these settings
5. **Locked during the season**
   - Given my tournament is active
   - When I try to change these settings
   - Then the change is refused (S-32)

## Out of scope
- Deadlines (S-24), point values (S-25), extra swim rules (S-26), realistic swim limits (S-93).

## Notes
- A swim of a type the tournament does not accept is handled like a missed extra rule (BR-27); accepted by the stakeholder at GATE 2 (2026-10-15, "ok").
- The single daily limit caps both counted distance and distance points (Q-48 item 4).
- "Longest swim counted" (default 10 km) caps how much of a swim counts; it is separate from the "longest realistic swim" (default 30 km, S-93), above which a swim is flagged for review (Q-56).
