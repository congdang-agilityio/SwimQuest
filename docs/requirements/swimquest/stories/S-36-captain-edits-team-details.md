# S-36: Captain edits team details; organizer can override

- **Priority:** P1
- **Covers:** FR-81, FR-55 · **Decisions:** Q-46
- **Depends on stories:** S-08

## User story
As a team captain, I want to change my team's name, emblem and description, so that the team feels like ours.

## Acceptance criteria
1. **Way in**
   - Given I am a captain
   - When I open My Team and choose "Edit team"
   - Then I see the team's name, emblem choice and description
2. **Save changes**
   - Given I change the name, emblem or description and save
   - When any member or other player views the team
   - Then they see the new details
3. **Not the limit**
   - Given I am a captain (not the organizer)
   - When I edit the team
   - Then I cannot change the member limit
4. **Organizer override**
   - Given I am the organizer
   - When I edit a team's name, emblem or description from the organizer page
   - Then my change replaces the captain's
5. **Audited, members cannot edit**
   - Given an edit was saved
   - When the audit trail is checked
   - Then it records who changed what; a member who is not captain is not offered "Edit team" and the server refuses it

## Out of scope
- Organizer team creation and limits (S-05).
