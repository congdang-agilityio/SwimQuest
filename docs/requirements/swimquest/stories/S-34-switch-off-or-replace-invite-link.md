# S-34: Switch off or replace the invite link

- **Priority:** P1
- **Covers:** FR-80 · **Decisions:** Q-45
- **Depends on stories:** S-06

## User story
As a tournament organizer, I want to switch off or replace the invite link, so that an unwanted link can no longer be used.

## Acceptance criteria
1. **Switch off**
   - Given my tournament's invite link is on
   - When I choose "Switch off link" on the organizer page and confirm
   - Then anyone opening the link sees that it no longer works, and nobody can join through it
2. **Switch back on**
   - Given the link is off
   - When I switch it on again
   - Then the same link works again
3. **Replace**
   - Given I choose "Replace link" and confirm
   - When the new link is shown
   - Then the old link stops working, including captain links with a preselected team, and the new one works
4. **Members unaffected**
   - Given I switched off or replaced the link
   - When existing members use the app
   - Then their membership is unchanged
5. **Audited**
   - Given I switched off or replaced the link
   - When the audit trail is checked
   - Then the action is recorded

## Out of scope
- Public listing joins (S-30) are not affected by the link.

## Notes
- Per A-17 and BR-15.
