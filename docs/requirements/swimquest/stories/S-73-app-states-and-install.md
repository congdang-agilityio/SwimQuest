# S-73: App states and installing SwimQuest as an app

- **Priority:** P1
- **Covers:** FR-59, NFR-01, NFR-10 · **Decisions:** Q-02
- **Depends on stories:** S-03

## User story
As a player, I want every screen to handle loading, empty, error, offline and no-access cases, and to install SwimQuest on my phone, so that the app feels reliable.

## Acceptance criteria
1. **Loading and empty**
   - Given any list or page in the app
   - When data is loading or there is nothing to show
   - Then a loading state or an empty state with a next step is shown, never a blank page
2. **Error**
   - Given a request fails
   - When the page shows the failure
   - Then I see a plain message and a "Try again" action
3. **Offline**
   - Given my phone has no connection
   - When I open the installed app or a page
   - Then I see an offline state and pages I already opened still show their last content
4. **Access denied**
   - Given I open a page I may not use (for example another team's captain tools or the admin area)
   - When it loads
   - Then I see an access-denied state with a way back home
5. **Install**
   - Given I use a supported phone browser
   - When I choose "Install app" (from Profile or the browser's own prompt)
   - Then SwimQuest is added to my home screen with its icon and opens full screen

## Out of scope
- Profile editor states (S-57).

## Notes
- Links opened inside Zalo's own browser may not allow installing (R-16); the install hint explains how to open the link in the phone's browser.
