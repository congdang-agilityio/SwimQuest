# S-68: Notification preferences per category

- **Priority:** P1
- **Covers:** FR-17, FR-53 · **Decisions:** Q-17
- **Depends on stories:** S-67

## User story
As a player, I want to switch off push for categories I do not care about, so that I only get the alerts I want.

## Acceptance criteria
1. **Way in**
   - Given I am signed in
   - When I open Profile → Notifications
   - Then I see the categories: tournament invitations, team updates, verification results, milestones, each with a push switch, all on by default
2. **Switch a category off**
   - Given I switch "Milestones" off
   - When my team passes a destination
   - Then I get no push for it
3. **In-app history kept**
   - Given a category is off for push
   - When an event of that category happens
   - Then it still appears in my in-app notification list
4. **Saved for my account**
   - Given I changed categories
   - When I log in on another device
   - Then the same category choices apply
5. **Back on**
   - Given I switch a category on again
   - When the next event happens
   - Then I get a push for it

## Out of scope
- Zalo group messages (S-89).

## Notes
- BA reading of AC 3: FR-17 lets each category be switched off "for push notifications"; the in-app list keeps the history (FR-53).
