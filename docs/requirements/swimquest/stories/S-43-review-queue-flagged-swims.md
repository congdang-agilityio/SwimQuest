# S-43: Review queue: decide flagged swims

- **Priority:** P1
- **Covers:** FR-45, FR-48, FR-71, FR-55, FR-30 · **Decisions:** Q-04, Q-35, Q-42
- **Depends on stories:** S-12

## User story
As a tournament organizer, I want a queue of flagged swims I can approve or reject, so that genuine swims still count and doubtful ones do not.

## Acceptance criteria
1. **Way in**
   - Given I am the organizer (or a review helper, S-45) of a tournament
   - When I choose "Review queue" on its organizer page
   - Then I see its flagged swims with player, date, distance, duration, pace, swim type and the failed check
2. **Approve**
   - Given a flagged swim
   - When I approve it
   - Then it becomes verified in my tournament and its points count for the player's team
3. **Reject**
   - Given a flagged swim
   - When I reject it with a short reason
   - Then it is rejected in my tournament and the player sees the reason
4. **Only my tournament**
   - Given the same swim is also flagged in another tournament
   - When I decide it in mine
   - Then the other tournament's status is unchanged and stays in its own queue
5. **Audited and private**
   - Given I decided a swim
   - When the audit trail is checked
   - Then it records who decided, when and the outcome; the review screen never shows the precise GPS track to anyone but authorised reviewers, and moderation notes are never public

## Out of scope
- Disputes (S-44); appointing helpers (S-45); manual entries (later release).

## Notes
- BR-24, BR-28, BR-38. A swim outside the tournament's realistic swim limits (S-12, S-93) shows the limit it failed and the swim's value, for example "slowest pace 5:00 per 100 m, this swim 5:30" (Q-56).
- Reviewers may need to see the swim's map shape to judge it, so AC 5 lets authorised reviewers (the tournament's organizer and review helpers) see the track and nobody else (NFR-05 forbids public exposure). Kept by the stakeholder at GATE 2 (2026-10-15, "đúng", correct).
