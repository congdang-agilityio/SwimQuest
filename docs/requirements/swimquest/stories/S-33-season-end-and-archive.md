# S-33: Season end, completion and archive

- **Priority:** P1
- **Covers:** FR-23, FR-29, FR-55 · **Decisions:** Q-22, Q-58
- **Depends on stories:** S-10

## User story
As a tournament organizer, I want the season to end at its set time and to archive the tournament when I am done, so that results are final and history is kept.

## Acceptance criteria
1. **Completed at the season end time**
   - Given an active tournament whose season ends on 30 November at 20:00 (Vietnam time)
   - When anyone views it at 19:59 and again at 20:00
   - Then it is ACTIVE at 19:59 and COMPLETED from 20:00, and joining is closed; swims that start after 20:00 do not count in it
2. **Final results**
   - Given the tournament is completed and its late-upload window (S-24, counted from the season end time) has passed
   - When members view the leaderboard
   - Then it is marked as final
3. **Archive**
   - Given my tournament is completed
   - When I choose "Archive" on its organizer page and confirm
   - Then its status is ARCHIVED, it disappears from active lists, and members can still view its results in their history
4. **History preserved and audited**
   - Given I archived the tournament
   - When the audit trail is checked
   - Then the archive action is recorded and earlier audit history is unchanged
5. **No changes after archive**
   - Given the tournament is archived
   - When anyone tries to edit it or upload swims for it
   - Then nothing changes

## Out of scope
- Season badge at season end (S-50); Zalo season-end message (S-88).

## Notes
- The season end is a date and time set by the organizer, pre-filled 23:59 on the end date (Q-58, S-04).
