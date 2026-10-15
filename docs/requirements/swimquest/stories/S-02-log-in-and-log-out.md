# S-02: Log in and log out

- **Priority:** P0
- **Covers:** FR-03, FR-08, FR-07 · **Decisions:** Q-01, Q-39
- **Depends on stories:** S-01

## User story
As a player, I want to log in and log out, so that only I can use my account.

## Acceptance criteria
1. **Successful login**
   - Given I have an active account
   - When I enter my email and password on the login page and submit
   - Then I am signed in and taken to the page I was trying to open, or to the home page
2. **Generic failure message**
   - Given I enter an unknown email, or a known email with a wrong password
   - When I submit the login form
   - Then I see the same generic message in both cases, which does not reveal whether an account exists
3. **Protected pages need login**
   - Given I am not signed in
   - When I open any page other than the welcome, sign-up, login or a public page
   - Then I am sent to the login page, and after logging in I return to the page I asked for
4. **Log out**
   - Given I am signed in
   - When I choose "Log out" from the account menu or the Profile tab
   - Then my session ends and I see the login page; using the back button does not show protected content
5. **Session expiry**
   - Given my session has expired
   - When I try to use a protected page or action
   - Then I am asked to log in again and nothing I did not confirm is saved

## Out of scope
- "Forgot password?" help and admin reset (S-59); changing my password (S-58).
- Suspended accounts being blocked at login (S-63).

## Notes
- The login page is the entry point for visitors until the welcome page exists (S-70); it links to sign-up (S-01).
- Session length is not specified; the Team Lead may propose a value.
