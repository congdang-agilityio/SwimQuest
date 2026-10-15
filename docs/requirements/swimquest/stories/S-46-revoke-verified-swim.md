# S-46: Revoke a verified swim

- **Priority:** P1
- **Covers:** FR-47, FR-45, FR-55, FR-41 · **Decisions:** Q-43, Q-13
- **Depends on stories:** S-43, S-21

## User story
As a tournament organizer (or review helper), I want to revoke a swim that should not have counted, so that the race stays fair.

## Acceptance criteria
1. **Revoke with reason**
   - Given a verified swim in my tournament
   - When I choose "Revoke" in the swim's details (from the review queue or the team roster) and enter a reason
   - Then its status in my tournament becomes revoked
2. **Points removed, history kept**
   - Given the swim is revoked
   - When points are recalculated
   - Then its points and bonuses are removed by a reversal entry, earlier entries stay in history, and the team's progress updates
3. **Week recalculated**
   - Given the swim was in a week with a multiplier
   - When it is revoked
   - Then that week's multiplier is recalculated
4. **XP removed**
   - Given the swim no longer counts in any tournament
   - When it is revoked
   - Then the XP it gave is removed
5. **Player sees it, audited**
   - Given my swim was revoked
   - When I open it
   - Then I see "revoked" and the reason, and the audit trail records who, when and why

## Out of scope
- Finish withdrawal (S-47); badges removed (S-48); collectibles removed (S-83, S-84).

## Notes
- Other tournaments' statuses for the same swim are unchanged (BR-28).
- Platform admins can also revoke as an exceptional override (S-72).
