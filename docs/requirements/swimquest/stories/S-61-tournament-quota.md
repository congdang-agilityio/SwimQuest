# S-61: Tournament quota: 3 per account, admin-approved requests for more

- **Priority:** P1
- **Covers:** FR-70, FR-21, FR-54, FR-55 · **Decisions:** Q-08
- **Depends on stories:** S-04, S-62

## User story
As a player, I want to create up to 3 tournaments and ask for more when I need them, so that organizing stays open but controlled.

## Acceptance criteria
1. **Limit reached**
   - Given I have created 3 tournaments (deleted drafts included)
   - When I choose "Create tournament"
   - Then I cannot create one and see a "Request more" option instead
2. **Send a request**
   - Given I am at the limit
   - When I send a request with a short reason
   - Then the request is pending and I see its status in the Tournaments tab
3. **Admin approves**
   - Given I am a platform admin
   - When I open "Tournament requests" in the admin area and approve a request
   - Then the player can create one more tournament and sees the approval
4. **Admin rejects**
   - Given a pending request
   - When I reject it with a reason
   - Then the player sees the rejection and reason and still cannot create a tournament
5. **Audited**
   - Given a request was decided
   - When the audit trail is checked
   - Then it records the admin, the decision, the reason and the time

## Out of scope
- Deleting drafts: no story; drafts still count (A-11).

## Notes
- A-11: each approval allows one more tournament. R-11.
