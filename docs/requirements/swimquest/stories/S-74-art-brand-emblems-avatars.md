# S-74: Art: brand marks, app icon, banner template, team emblems and default avatars

- **Priority:** P1
- **Covers:** FR-61, NFR-11, NFR-12 · **Decisions:** Q-19, Q-47
- **Depends on stories:** none

## User story
As the stakeholder, I want the brand marks, app icon, tournament banner template, at least 8 team emblems and default avatars delivered, so that the app looks finished and teams and players have identity.

## Acceptance criteria
1. **Brand marks and app icon**
   - Given the delivered art
   - When the app is opened or installed
   - Then the SwimQuest logo appears in the header and welcome page and the app icon/favicon is used, readable at 24, 32 and 48 px
2. **Team emblems**
   - Given an organizer or captain chooses an emblem
   - When the emblem list opens
   - Then at least 8 different emblems are available (cut out from the concept image or simple vector stand-ins)
3. **Default avatars**
   - Given a player has no uploaded avatar
   - When their profile or roster entry is shown
   - Then one of the default avatars is shown
4. **Banner template**
   - Given a tournament has no uploaded banner
   - When its details page is shown
   - Then the banner template is shown with the tournament's name as text over it, not in the image
5. **Listed for replacement**
   - Given these assets
   - When the stakeholder opens the asset replacement list (S-77)
   - Then each one is listed with its source and replacement spec

## Out of scope
- Map and ships (S-18); swimmers (S-75); badges and collectibles (S-76).

## Notes
- The concept image shows only 4 emblems and no app icon, avatars or banner template (R-03); these are mostly vector stand-ins.
