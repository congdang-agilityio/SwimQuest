# S-32: Edit a tournament within its lifecycle rules

- **Priority:** P1
- **Covers:** FR-24, FR-55, FR-40 · **Decisions:** Q-22, Q-25, Q-48, Q-56, Q-58
- **Depends on stories:** S-10

## User story
As a tournament organizer, I want to edit my tournament where it is allowed and be stopped where it would be unfair, so that players can trust the rules.

## Acceptance criteria
1. **Draft and published edits**
   - Given my tournament is a draft or published (season not started)
   - When I edit its fields, settings or rules and save
   - Then the changes are saved and shown to players
2. **Season configuration locked when active**
   - Given my tournament is active
   - When I try to change the route, route distance, season start (date and time), point values, swim settings, realistic swim limits or extra rules
   - Then the change is refused with a message that these are locked for the season
3. **Allowed changes are audited**
   - Given I change something after publishing
   - When the audit trail is checked
   - Then it shows who, when, the field and old and new values
4. **Only the owner**
   - Given I am not this tournament's organizer (or a platform admin)
   - When I try to edit it
   - Then the edit is not offered and the server refuses it
5. **Players see published changes**
   - Given I changed the published tournament's description or rules text
   - When a member opens the details page
   - Then they see the current text

## Out of scope
- Archive (S-33); admin overrides (S-72).

## Notes
- Which fields stay editable while active (for example description or contact channel) is not listed in the requirements; this story locks the season configuration only (FR-24, BR-06).
