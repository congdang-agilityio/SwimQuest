# S-66: In-app notifications

- **Priority:** P1
- **Covers:** FR-53, FR-42, FR-84 · **Decisions:** Q-17, Q-13, Q-57
- **Depends on stories:** S-12, S-19

## User story
As a player, I want a notification list in the app, so that I know when something happens to my swims, my team or our voyage.

## Acceptance criteria
1. **Way in and unread count**
   - Given I am signed in
   - When I look at the header
   - Then a bell shows the number of unread notifications and opens the list
2. **Verification results**
   - Given my swim was verified, flagged, rejected, revoked or did not count by a rule, or my dispute was decided
   - When that happens
   - Then I get a notification saying so, linking to the swim
3. **Team updates**
   - Given I joined a team, was moved, removed, made captain, or my team's start was chosen, assigned automatically (S-94) or locked
   - When that happens
   - Then I get a notification linking to My Team
4. **Milestones**
   - Given my team passed a destination, reached Lý Sơn, lost its finish, or I earned a badge or level
   - When that happens
   - Then I get a notification linking to Voyage or my badges
5. **History**
   - Given I open the list
   - When I read notifications
   - Then they are marked read, and older ones stay in the history, newest first

## Out of scope
- Push (S-67); preferences (S-68).

## Notes
- No email notifications (Q-17).
- "Tournament invitations" (FR-17) apply when the organizer adds me to a team (S-42), the only invitation-like event in release 1 (BA reading).
