# S-90: Connect section with "coming soon" sources

- **Priority:** P2
- **Covers:** FR-67 · **Decisions:** Q-34, Q-38
- **Depends on stories:** S-11

## User story
As a player, I want to see which activity sources are coming, so that I know uploads are just the start.

## Acceptance criteria
1. **Way in**
   - Given I am signed in
   - When I open Add swim (Connect)
   - Then I see "Upload GPX/FIT file" first and below it Strava, Garmin, Coros and Suunto
2. **Marked coming soon**
   - Given the listed sources
   - When I look at Strava, Garmin, Coros and Suunto
   - Then each is marked "coming soon"
3. **Do nothing**
   - Given a "coming soon" source
   - When I tap it
   - Then nothing is connected and no data leaves the app; at most a short "coming soon" note appears
4. **No manual entry**
   - Given the Connect section
   - When I look at it
   - Then there is no manual entry option
5. **Upload still first**
   - Given the section
   - When it opens
   - Then upload is the only working option and is clearly usable

## Out of scope
- Real connections (later release, Q-34).

## Notes
- A-20. Brand names follow each provider's brand rules when built (NFR-04 later release).
