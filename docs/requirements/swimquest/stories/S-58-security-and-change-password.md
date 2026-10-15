# S-58: Security section and changing my password

- **Priority:** P1
- **Covers:** FR-18, FR-03 · **Decisions:** Q-39
- **Depends on stories:** S-53

## User story
As a player, I want a Security section where I can change my password and see how I sign in, so that I keep my account safe.

## Acceptance criteria
1. **Way in**
   - Given I am on my profile
   - When I choose "Security"
   - Then I see my login method (email and password), "Change password", and how to recover the account (contact a platform admin)
2. **Change password**
   - Given I enter my current password and a new password that meets the rule, twice
   - When I save
   - Then my password changes and I see a confirmation
3. **Wrong current password**
   - Given I enter a wrong current password
   - When I save
   - Then the password is not changed and I see an error
4. **New password checks**
   - Given the two new password entries differ, or the new password does not meet the password rule
   - When I save
   - Then the password is not changed and the field shows why
5. **Audited**
   - Given my password changed
   - When the audit trail is checked
   - Then the change is recorded (without the password)

## Out of scope
- A list of active sessions: FR-18 says "if supported"; not included unless the Team Lead finds it cheap.
- Admin password reset (S-59).

## Notes
- The password rule is the same as at sign-up (S-01).
