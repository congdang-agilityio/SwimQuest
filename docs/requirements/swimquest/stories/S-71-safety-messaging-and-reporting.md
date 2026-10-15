# S-71: Safety messages and reporting a problem

- **Priority:** P1
- **Covers:** FR-58, NFR-07 · **Decisions:** Q-01
- **Depends on stories:** S-11, S-62

## User story
As a player, I want clear safety advice and a way to report a problem, so that the game encourages safe swimming and abuse can be dealt with.

## Acceptance criteria
1. **Safety page**
   - Given I am signed in
   - When I open "Swim safely" from the Profile tab or the Add swim screen
   - Then I see safety advice: no night swimming, no swimming alone in open water, swim within your limits, the map is not a real route
2. **Reminder when uploading**
   - Given I open Add swim
   - When the screen shows
   - Then a short safety reminder links to the safety page
3. **Report**
   - Given I see a player, team, tournament or swim that breaks the rules or seems unsafe
   - When I choose "Report" on it and write what is wrong
   - Then the report is sent to the platform admins and I see a confirmation
4. **Reporter protected**
   - Given I reported something
   - When the reported person views anything
   - Then they never see who reported them
5. **No unsafe rewards in copy**
   - Given any goal, badge or reward text in the app
   - When it is reviewed against the safety list
   - Then none encourages unsafe distance, pace, night swimming or solo open-water swimming

## Out of scope
- Admin handling of reports (S-72).
