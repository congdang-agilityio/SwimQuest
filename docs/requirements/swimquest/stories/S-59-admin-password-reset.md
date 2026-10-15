# S-59: Forgot password: admin resets it, player sets a new one

- **Priority:** P1
- **Covers:** FR-03, FR-18, FR-54, FR-55 · **Decisions:** Q-39
- **Depends on stories:** S-02, S-62

## User story
As a player who forgot my password, I want a platform admin to reset it for me, so that I can get back into my account without email.

## Acceptance criteria
1. **Forgot password help**
   - Given I am on the login page
   - When I choose "Forgot password?"
   - Then I see how to contact the platform admin (the contact is shown) and that no email is sent
2. **Admin sets a temporary password**
   - Given I am a platform admin
   - When I find the player in the admin area's user list, choose "Reset password" and confirm
   - Then a temporary password is set and shown to me once, to pass to the player outside the app
3. **New password at next login**
   - Given my password was reset
   - When I log in with the temporary password
   - Then I must choose a new password before I can use the app
4. **Audited**
   - Given an admin reset a password
   - When the audit trail is checked
   - Then it records the admin, the player and the time (never the password)
5. **Admins only**
   - Given I am not a platform admin
   - When I try to reset another user's password
   - Then it is not offered and the server refuses it

## Out of scope
- Self-service reset or any email (Q-39, Q-17).

## Notes
- A-25. The admin should check who is asking before resetting (R-09).
- The admin contact shown on the login page is a setting the platform admin maintains (BA reading).
