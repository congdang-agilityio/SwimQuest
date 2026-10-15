# S-53: My Profile page: view and edit basic info

- **Priority:** P1
- **Covers:** FR-11, FR-12 · **Decisions:** Q-30, Q-01
- **Depends on stories:** S-03

## User story
As a player, I want a profile page where I can see and edit my display name, avatar, cover, bio and city, so that others recognise me.

## Acceptance criteria
1. **Way in**
   - Given I am signed in
   - When I open the Profile tab or "My Profile" in the account menu
   - Then I see my profile in view mode
2. **Edit mode**
   - Given I am viewing my profile
   - When I choose "Edit profile"
   - Then I can change display name, avatar (upload or a default avatar), optional cover image, short bio and optional city/region
3. **Validation**
   - Given I enter a display name that is empty or a bio over its character limit
   - When I try to save
   - Then I see the limit and it is not saved
4. **Save**
   - Given valid changes
   - When I save
   - Then I return to view mode and others see the new display name and avatar
5. **No precise location**
   - Given I set a city/region
   - When I look at the field
   - Then it accepts only a city or region name, never a precise address or GPS location

## Out of scope
- Swim goals (S-54), stats (S-55), privacy (S-56), editor states (S-57), security (S-58).

## Notes
- Display name is not unique (A-27). Default avatars come from S-74.
- Character limits are not specified; the Team Lead may propose them.
