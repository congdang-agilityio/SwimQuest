# S-62: Admin area and platform admin roles

- **Priority:** P1
- **Covers:** FR-09, FR-54, FR-55 · **Decisions:** Q-02
- **Depends on stories:** S-03

## User story
As a platform admin, I want an admin area where I can find users and grant or remove the admin role, so that the platform can be run by more than one person.

## Acceptance criteria
1. **First admin**
   - Given a fresh staging environment
   - When the operator sets up the first platform admin outside the app
   - Then that user sees the "Admin" entry in the menu
2. **Way in and user list**
   - Given I am a platform admin
   - When I choose "Admin" and open "Users"
   - Then I can search users by display name or email and open a user
3. **Grant or remove admin**
   - Given I open a user
   - When I grant or remove the platform admin role and confirm
   - Then their access changes at once
4. **Audited**
   - Given an admin role changed
   - When the audit trail is checked
   - Then it records who, whom, old and new role and when
5. **Not for others**
   - Given I am not a platform admin
   - When I try to open the admin area
   - Then I see an access-denied state and the server refuses every admin function

## Out of scope
- Other admin functions (S-59, S-61, S-63, S-64, S-72, S-78).

## Notes
- A-07. An admin cannot remove their own admin role if they are the last admin (BA addition, to avoid locking everyone out; kept by the stakeholder at GATE 2, 2026-10-15, "đúng", correct).
- Organizer role does not grant admin (BR-09).
