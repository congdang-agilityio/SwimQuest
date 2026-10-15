# S-03: App navigation and home page

- **Priority:** P0
- **Covers:** FR-60, FR-09, FR-59 · **Decisions:** Q-02, Q-20
- **Depends on stories:** S-02

## User story
As a player, I want a clear menu and a home page that shows my tournaments, so that I always know where to go next.

## Acceptance criteria
1. **Mobile bottom bar**
   - Given I am signed in on a phone-sized screen
   - When any signed-in page is shown
   - Then a bottom bar shows Home, Tournaments, My Team, Voyage and Profile, with the current tab marked by more than colour alone
2. **Desktop navigation**
   - Given I am signed in on a desktop-sized screen
   - When any signed-in page is shown
   - Then the same five destinations appear as left or top navigation
3. **Home page with my tournaments**
   - Given I am a member of one or more tournaments
   - When I open Home
   - Then I see each tournament with my team, its status and my team's progress %, and an "Add swim" button (S-11)
4. **Empty home page**
   - Given I am in no tournament
   - When I open Home
   - Then I see an empty state explaining how to join (open an invite link) and a "Create tournament" button (S-04); My Team and Voyage show the same guidance
5. **Role-based entries**
   - Given I hold no organizer or admin role
   - When I look at the menus
   - Then organizer and admin entries are not shown; a user with those roles sees them (organizer: on their tournaments; admin: an "Admin" entry), and the server refuses those functions to anyone without the role

## Out of scope
- Switching between several tournaments in My Team and Voyage (S-69); until then they show the most recently joined tournament.
- Public tournament discovery in the Tournaments tab (S-31); in P0 the Tournaments tab lists the tournaments I organize or belong to and has the "Create tournament" button.

## Notes
- Touch targets at least 44×44 CSS px (NFR-10).
