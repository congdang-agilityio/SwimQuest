# S-11: Upload a GPX or FIT swim file

- **Priority:** P0
- **Covers:** FR-65, FR-44, FR-67 · **Decisions:** Q-03, Q-34, Q-38
- **Depends on stories:** S-03

## User story
As a player, I want to upload the GPX or FIT file my watch or app exported, so that my swim counts for my team.

## Acceptance criteria
1. **Way in**
   - Given I am signed in
   - When I choose "Add swim" on Home or My Team
   - Then the Connect screen opens with an "Upload GPX/FIT file" option
2. **Upload and read the swim**
   - Given I choose a valid GPX or FIT file of a swim
   - When the upload finishes
   - Then I see the swim's date and start time, distance (m/km), duration, pace per 100 m and swim type (pool or open water) and its status
3. **Unsupported or unreadable file**
   - Given I choose a file that is not GPX or FIT, or that contains no readable activity data
   - When I upload it
   - Then nothing is saved and I see why, with a hint about exporting GPX/FIT from my watch or app
4. **Only my own swims**
   - Given I am signed in as one player
   - When I upload a file
   - Then the swim is saved for me only; there is no way to submit a swim for another player
5. **Privacy of the track**
   - Given my swim has a GPS track
   - When anyone other than me views my swim, team or profile
   - Then they never see my precise GPS points or raw track

## Out of scope
- The checks run on the swim (S-12); "coming soon" sources in Connect (S-90); manual entry (later release, not shown, A-20).

## Notes
- Some pool swims exported as GPX carry no distance (R-15); such a file falls under AC 3 or is flagged by S-12.
- Metric units only (NFR-21).
