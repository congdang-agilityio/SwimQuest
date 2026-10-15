# S-60: Switch between Vietnamese and English

- **Priority:** P1
- **Covers:** FR-69 · **Decisions:** Q-07, Q-40
- **Depends on stories:** S-03

## User story
As a user, I want to switch the app between Vietnamese and English, so that I can use the language I read best.

## Acceptance criteria
1. **Way in**
   - Given I am on any page (signed in or not)
   - When I open the language switch (in the account menu, on the Profile tab, and on the welcome, login and sign-up pages)
   - Then I can choose Tiếng Việt or English
2. **Whole app switches**
   - Given I choose English
   - When the page updates
   - Then every screen, label, error and in-app message is in English
3. **Remembered**
   - Given I chose a language
   - When I come back later on the same device, or log in on another device
   - Then the app uses my chosen language
4. **Vietnamese by default**
   - Given a first-time visitor who never chose a language
   - When they open the app
   - Then it is in Vietnamese
5. **Organizer text unchanged**
   - Given a tournament name and rules typed by its organizer
   - When I switch language
   - Then they stay as typed

## Out of scope
- Zalo messages, which are Vietnamese only (S-85 to S-89).

## Notes
- Push messages follow the user's chosen language (S-67).
