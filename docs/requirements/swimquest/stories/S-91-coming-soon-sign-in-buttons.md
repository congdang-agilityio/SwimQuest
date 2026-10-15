# S-91: "Coming soon" sign-in buttons

- **Priority:** P2
- **Covers:** FR-04, FR-64 · **Decisions:** Q-05, Q-33
- **Depends on stories:** S-01, S-02

## User story
As a visitor, I want to see that Strava, Google and Facebook sign-in are coming, so that I know they will be available later.

## Acceptance criteria
1. **Buttons shown**
   - Given I am on the login or sign-up page
   - When I look below the email form
   - Then I see "Continue with Strava", "Continue with Google" and "Continue with Facebook"
2. **Marked coming soon**
   - Given these buttons
   - When I look at them
   - Then each is marked "coming soon" and looks unavailable
3. **Do nothing**
   - Given I tap one
   - When nothing happens beyond a short "coming soon" note
   - Then no sign-in starts and I stay on the page
4. **Email is the way**
   - Given the buttons
   - When I read the page
   - Then the email form is clearly the way to sign in or sign up
5. **No Apple**
   - Given the buttons
   - When I look
   - Then there is no Apple sign-in button

## Out of scope
- Working external sign-in and linking (later release, Q-33).
