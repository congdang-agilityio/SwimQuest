# S-29: Optional tournament fields and written rules

- **Priority:** P1
- **Covers:** FR-21, FR-78, FR-74 · **Decisions:** Q-27, Q-44
- **Depends on stories:** S-04

## User story
As a tournament organizer, I want to add a banner, logo, rules link, eligibility notes, a contact channel and written rules, so that players get the full picture of my tournament.

## Acceptance criteria
1. **Images**
   - Given I edit my draft
   - When I upload a banner and a logo (or keep the banner template)
   - Then they appear on the tournament details page and the join page
2. **Links and contact**
   - Given I enter a rules URL and a contact channel
   - When players open the details page
   - Then they see them; an invalid URL is rejected with a message
3. **Eligibility notes**
   - Given I write free-text eligibility notes
   - When players join
   - Then they see the notes, and the system does not check them
4. **Written rules text**
   - Given I write the tournament's rules text in "Rules and settings"
   - When players open the Rules section
   - Then they see my text as typed
5. **All optional**
   - Given I leave every optional field empty
   - When I publish
   - Then publishing is not blocked by them

## Out of scope
- The banner template art (S-74).
