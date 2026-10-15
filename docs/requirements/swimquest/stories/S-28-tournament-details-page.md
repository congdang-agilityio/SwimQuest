# S-28: Tournament details and rules page

- **Priority:** P1
- **Covers:** FR-27, FR-74, FR-78 · **Decisions:** Q-10, Q-44, Q-27, Q-56, Q-58
- **Depends on stories:** S-23

## User story
As a player, I want a page that shows a tournament's details and rules, so that I know what I am joining.

## Acceptance criteria
1. **Way in**
   - Given I can see a tournament (I am a member, it is public, or I opened its invite link)
   - When I tap it in the Tournaments tab, on Home, or choose "Details and rules" on the join page
   - Then the tournament details page opens
2. **Content**
   - Given the details page is open
   - When I read it
   - Then I see name, description, organizer, status, season start and end (dates and times, Vietnam time), route, route distance, teams with free places, and optional banner, logo, rules link, eligibility notes and contact channel when set
3. **Rules and settings**
   - Given the organizer set rules and settings
   - When I open the "Rules" section
   - Then I see the written rules text, the settings in force (S-23, S-24, S-25), the realistic swim limits (S-93) and the extra swim rules (S-26)
4. **Organizer text as typed**
   - Given the organizer typed texts in one language
   - When I switch app language
   - Then the app's labels change but the organizer's texts stay as typed
5. **Join from here**
   - Given joining is open and I am not a member
   - When I choose "Join"
   - Then I go to team choice (S-07)

## Out of scope
- Setting the written rules text: entered as part of "Rules and settings" in S-29.
- Zalo notice (S-89).
