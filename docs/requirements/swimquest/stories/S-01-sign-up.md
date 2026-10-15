# S-01: Sign up with email, password and display name

- **Priority:** P0
- **Covers:** FR-01, FR-07, FR-69 · **Decisions:** Q-01, Q-05, Q-30, Q-40
- **Depends on stories:** none

## User story
As a visitor, I want to create an account with my email, a password and a display name, so that I can start playing straight away.

## Acceptance criteria
1. **Account created and usable at once**
   - Given I am on the sign-up page (reached from the "Sign up" link on the login page; S-70 adds the welcome page link)
   - When I enter a valid email, a password and a display name and submit
   - Then my account is created in the active state without any email verification, I am signed in and I land on the home page (S-03)
2. **Required fields and validation**
   - Given I am on the sign-up page
   - When I leave the email, password or display name empty, enter an invalid email, or a password that does not meet the password rule
   - Then the form is not submitted and each field shows a labelled, specific error message
3. **Email already used**
   - Given an account already exists with my email
   - When I submit the sign-up form with that email
   - Then no second account is created and I see a message that I cannot use this email, with a link to the login page
4. **Vietnamese by default**
   - Given I am a first-time visitor who has never chosen a language
   - When I open the sign-up page
   - Then all text is in Vietnamese (English is available once S-60 adds the language switch)
5. **Display name is what others see**
   - Given I signed up with display name "Lan"
   - When I open my team page or any other page that shows players
   - Then I am shown as "Lan", never by my email address

## Out of scope
- Strava, Google and Facebook "coming soon" buttons (S-91).
- Language switch (S-60); profile editing (S-53).
- Email verification (dropped, Q-01).

## Notes
- The display name does not have to be unique and can be changed later in My Profile (A-27).
- Email is private by default (FR-16, NFR-05).
- The password rule (minimum length etc.) is not specified in the requirements; the Team Lead may propose a standard rule.
