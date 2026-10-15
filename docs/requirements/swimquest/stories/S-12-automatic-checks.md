# S-12: Automatic checks verify or flag an uploaded swim

- **Priority:** P0
- **Covers:** FR-68, FR-45, FR-46 · **Decisions:** Q-04, Q-36, Q-37, Q-56, Q-58
- **Depends on stories:** S-11, S-10

## User story
As a player, I want my uploaded swim checked automatically, so that a real swim counts at once and the game stays fair.

## Acceptance criteria
1. **Passing swim is verified**
   - Given I upload a swim (pool or open water) that is a swim, whose start time is inside the season start and end (date and time) of a tournament I am active in, that is not a duplicate, and whose pace and distance are inside that tournament's realistic swim limits
   - When the checks run
   - Then it is "verified" in that tournament without anyone reviewing it
2. **Not a swim, or unrealistic for the tournament**
   - Given the file is not a swim activity, or its pace or distance is outside the tournament's realistic swim limits (for example with the defaults, a pace faster than 1:05 per 100 m, slower than 5:00 per 100 m, or a swim longer than 30 km)
   - When the checks run
   - Then it is "flagged" in that tournament, does not count, goes to that tournament's review queue (decided in S-43), and I see in plain words which check it failed
3. **Outside the season, by start time**
   - Given a tournament's season starts 1 November at 06:00 and my swim started at 05:30 that day (Vietnam time)
   - When the checks run
   - Then it is "flagged" for that tournament and goes to its review queue, and I see the reason; a swim that started at 06:00 or later (and not after the season end time) passes this check
4. **Duplicates**
   - Given I upload the same file again, or a swim whose time overlaps one of my existing swims
   - When the checks run
   - Then it is marked "duplicate" and never counts, I see why, and the original swim is unchanged
5. **Limits are per tournament**
   - Given I am active in two tournaments, one with a slowest pace of 5:00 per 100 m and one with 4:00 per 100 m
   - When I upload a swim at 4:30 per 100 m
   - Then it is verified in the first tournament and flagged in the second, and My swims shows each status separately (S-16)

## Out of scope
- Organizer extra rules (S-26, S-27); the organizer changing the tournament's realistic swim limits (S-93); the admin setting the platform defaults and bounds (S-64); review decisions (S-43); disputes (S-44).

## Notes
- Each tournament's realistic swim limits are pre-filled from the platform defaults when it is created (FR-78 item 9; starting values 1:05 and 5:00 per 100 m and 30 km, Q-56); in P0 every tournament uses these defaults until S-93 lets organizers change them.
- "Longest realistic swim" (default 30 km, flags the swim) is separate from "longest swim counted" (default 10 km, S-23, caps the counted distance).
- Falling outside a realistic limit means "flagged for review"; missing an extra rule means "does not count, dispute only" (BR-38, S-27).
- A swim belongs to the day it started, Vietnam time (A-26), for the daily limit and the long-swim bonus; whether it is inside the season is decided by its start time against the season's start and end date-times (Q-58).
- A swim is stored once and checked per tournament the player is active in (FR-30, FR-46).
