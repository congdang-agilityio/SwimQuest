# S-10: Season start: tournament becomes active and the start choice locks

- **Priority:** P0
- **Covers:** FR-23, FR-39, FR-40 · **Decisions:** Q-22, Q-24, Q-57, Q-58
- **Depends on stories:** S-09

## User story
As a player, I want the season to start at its set time and the team's start to be fixed from then on, so that the race is fair for everyone.

## Acceptance criteria
1. **Tournament becomes active at the season start time**
   - Given a published tournament whose season start is 1 November at 06:00 (Vietnam time)
   - When anyone views it at 05:59 and again at 06:00
   - Then it is PUBLISHED at 05:59 and ACTIVE from 06:00; swims that start at or after 06:00 can count, and joining is still open
2. **Start choice locks at the deadline**
   - Given the start-choice deadline (date and time) is reached (the season start time unless S-24 sets another one)
   - When the captain opens the start selection
   - Then it shows the team's start as locked, with the lock time, and offers no change; this is the same whether the start was chosen or assigned automatically (S-94)
3. **Different choice after lock fails**
   - Given the start is locked
   - When anyone sends a different start choice
   - Then it is refused with a clear message; sending the same start again is harmless and changes nothing
4. **Route distance fixed for the season**
   - Given the season has started
   - When the organizer tries to change the route or the route distance
   - Then the change is refused
5. **Organizer sees lock status**
   - Given I am the organizer
   - When I open my tournament's organizer page
   - Then I see for each team its start (chosen, or "assigned automatically" per S-94) and whether it is locked

## Out of scope
- Assigning a start to a team that has none at the deadline (S-94).
- Exceptional corrections after the lock (S-72, platform admin, audited).
- Season end and completion (S-33).

## Notes
- All times are Vietnam time, UTC+7 (NFR-20); the season start is a date and time set by the organizer (Q-58, S-04).
- A swim is inside the season when its start time is inside the season range (FR-68, checked in S-12).
