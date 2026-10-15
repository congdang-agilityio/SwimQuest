# S-70: Welcome page for visitors

- **Priority:** P1
- **Covers:** FR-63, FR-58 · **Decisions:** Q-01
- **Depends on stories:** S-01, S-02, S-74

## User story
As a visitor, I want a welcome page that explains SwimQuest, so that I understand the game before I sign up.

## Acceptance criteria
1. **Way in**
   - Given I am not signed in
   - When I open the app's main address
   - Then I see the welcome page
2. **Content**
   - Given I am on the welcome page
   - When I read it
   - Then I see what SwimQuest is (team swimming voyage to Lý Sơn), how it works in a few steps (join a team, upload swims, move the ship) and the brand art
3. **Calls to action**
   - Given I am on the welcome page
   - When I choose "Sign up" or "Log in"
   - Then I go to the sign-up or login page
4. **Safety note**
   - Given I read the welcome page
   - When I reach the bottom
   - Then I see a short safety note that the map is a game and to swim safely
5. **Signed-in users skip it**
   - Given I am signed in
   - When I open the main address
   - Then I go to Home

## Out of scope
- Language switch on this page (S-60).
