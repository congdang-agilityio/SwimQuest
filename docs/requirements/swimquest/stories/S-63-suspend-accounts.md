# S-63: Admin suspends and reactivates accounts

- **Priority:** P1
- **Covers:** FR-07, FR-54, FR-55 · **Decisions:** Q-01
- **Depends on stories:** S-62

## User story
As a platform admin, I want to suspend an account that breaks the rules and reactivate it later, so that abuse can be stopped.

## Acceptance criteria
1. **Suspend with reason**
   - Given I open a user in the admin area
   - When I choose "Suspend", enter a reason and confirm
   - Then the account is suspended
2. **Suspended user blocked**
   - Given my account is suspended
   - When I try to log in or use any protected function
   - Then I am refused with a message that the account is suspended and how to contact the admin
3. **Data kept**
   - Given a player is suspended
   - When teams and leaderboards are viewed
   - Then their earlier verified swims and points are unchanged
4. **Reactivate**
   - Given an account is suspended
   - When I choose "Reactivate" with a reason
   - Then the user can log in again
5. **Audited**
   - Given an account state changed
   - When the audit trail is checked
   - Then it records actor, reason, old and new state and time

## Out of scope
- Deletion pending and deleted states: they come with account deletion, deferred (Q-18, FR-10).

## Notes
- BA reading of AC 3: the requirements do not say what a suspension does to swims already counted; this story keeps them (overrides never silently rewrite scoring, FR-54).
