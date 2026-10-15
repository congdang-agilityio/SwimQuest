# S-44: Dispute a swim's result

- **Priority:** P1
- **Covers:** FR-48, FR-72, FR-58 · **Decisions:** Q-41, Q-42
- **Depends on stories:** S-43, S-27

## User story
As a player, I want to dispute a swim result I think is wrong, so that a person looks at it again.

## Acceptance criteria
1. **Raise a dispute**
   - Given my swim was rejected, marked duplicate, or did not count because of a rule in a tournament
   - When I open it in My swims, choose "Dispute" for that tournament and write a reason
   - Then its status there becomes "disputed" and it appears in that tournament's review queue
2. **Reviewer decides**
   - Given a disputed swim in my review queue (organizer or helper)
   - When I accept or reject the dispute with a short reason
   - Then the swim counts (accepted) or keeps its earlier status (rejected), in that tournament only
3. **Player sees the outcome**
   - Given my dispute was decided
   - When I open the swim
   - Then I see the decision and the reviewer's reason
4. **One open dispute per swim and tournament**
   - Given I already have an open dispute for this swim in this tournament
   - When I look at the swim
   - Then "Dispute" is not offered again until it is decided
5. **Audited**
   - Given a dispute was decided
   - When the audit trail is checked
   - Then the decision is recorded

## Out of scope
- Reporting abuse or safety issues (S-71).

## Notes
- Disputed swims do not count while open (BR-04).
- BA reading: a verified swim cannot be disputed by its owner (nothing to dispute).
