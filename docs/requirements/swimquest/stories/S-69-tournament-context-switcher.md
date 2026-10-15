# S-69: Tournament switcher and desktop layout

- **Priority:** P1
- **Covers:** FR-60, FR-30, NFR-01 · **Decisions:** Q-09, Q-20, Q-02
- **Depends on stories:** S-03, S-65

## User story
As a player in several tournaments, I want to switch which tournament My Team and Voyage show, so that I can follow each of my teams.

## Acceptance criteria
1. **Switcher on mobile**
   - Given I am in two or more tournaments
   - When I open My Team or Voyage
   - Then a tournament switcher at the top shows the current tournament and lets me pick another
2. **Switcher on desktop**
   - Given I use a desktop-sized screen
   - When I look at the navigation
   - Then a tournament context switcher sits in the left or top navigation
3. **Choice remembered**
   - Given I switched to a tournament
   - When I move between tabs or come back later
   - Then the same tournament stays selected until I change it
4. **Single tournament**
   - Given I am in only one tournament
   - When I open My Team or Voyage
   - Then no switcher is shown
5. **Organizer screens on desktop**
   - Given I am an organizer or admin on a desktop screen
   - When I use the organizer console or admin area
   - Then tables and forms use the wider space and every function works with keyboard and mouse

## Out of scope
- Home already lists all my tournaments (S-03).
