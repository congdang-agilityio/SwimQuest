# S-24: Tournament settings: submission deadline and start-choice deadline

- **Priority:** P1
- **Covers:** FR-78, FR-39, FR-74, FR-84 · **Decisions:** Q-44, Q-24, Q-57, Q-58
- **Depends on stories:** S-10, S-23, S-94

## User story
As a tournament organizer, I want to set how long players have to upload a swim and when the start choice closes, so that results are settled on time.

## Acceptance criteria
1. **Defaults**
   - Given I open "Rules and settings" of my draft
   - When I look at the deadlines
   - Then I see: a swim must be uploaded within 7 days of the swim date and no later than 3 days after the season end time; the start choice closes at the season start time (date and time shown)
2. **Late upload does not count**
   - Given the submission deadline is 7 days
   - When a player uploads a swim 8 days after its date
   - Then it does not count in my tournament and the player sees "uploaded after the deadline"
3. **After the season, counted from the end time**
   - Given the season ended on 30 November at 20:00 and M is 3 days
   - When a player uploads a swim from the season on 3 December at 19:00, and another on 3 December at 20:01 (Vietnam time)
   - Then the first can count and the second does not count in my tournament
4. **Earlier start-choice deadline**
   - Given I set the start-choice deadline to a date and time before the season start
   - When that time passes (Vietnam time)
   - Then the start choice locks then (as in S-10), teams with no start get one automatically at that moment (S-94), and captains saw the deadline on the start screen
5. **Changed values shown**
   - Given I changed N, M or the start-choice deadline
   - When players view the tournament details
   - Then they see the values in force

## Out of scope
- Other settings (S-23, S-25, S-26, S-93); how the automatic start is picked (S-94).

## Notes
- BA reading: a start-choice deadline after the season start is not offered (FR-39: lock at the configured deadline, default the season start time).
- If the organizer changes the season start time while the deadline is still the default, the deadline follows it (the default is "the season start time", Q-58).
- The swim date is the day the swim started, Vietnam time (A-26).
