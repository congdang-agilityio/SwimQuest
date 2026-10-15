# S-57: Profile editor: unsaved changes, loading, offline and errors

- **Priority:** P1
- **Covers:** FR-19 · **Decisions:** Q-01
- **Depends on stories:** S-53

## User story
As a player, I want the profile editor to protect my changes and tell me what is happening, so that I never lose edits by accident.

## Acceptance criteria
1. **Unsaved changes warning**
   - Given I changed something in edit mode
   - When I try to leave the page or switch tab
   - Then I am asked whether to discard the changes
2. **Loading**
   - Given my profile is loading
   - When the page opens
   - Then I see a loading state, not an empty form
3. **Empty sections**
   - Given I have no bio, goals or badges yet
   - When I view my profile
   - Then each empty section shows a short hint instead of blank space
4. **Offline**
   - Given I lose the connection while editing
   - When I try to save
   - Then I see that I am offline and my edits stay in the form
5. **Save error**
   - Given the save fails
   - When the error returns
   - Then I see what went wrong and can retry without retyping

## Out of scope
- App-wide states (S-73).
