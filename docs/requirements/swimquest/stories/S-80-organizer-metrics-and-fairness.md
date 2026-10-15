# S-80: Organizer metrics and fairness view

- **Priority:** P2
- **Covers:** FR-57 · **Decisions:** Q-01
- **Depends on stories:** S-65

## User story
As a tournament organizer, I want metrics on participation, verification and progress by start, so that I can see whether my tournament is healthy and fair.

## Acceptance criteria
1. **Way in**
   - Given I am the organizer
   - When I choose "Metrics" in the organizer console
   - Then the metrics page opens
2. **Participation**
   - Given the season is running
   - When I view metrics
   - Then I see members joined, weekly active swimmers and active members per team
3. **Verification rates**
   - Given swims were checked
   - When I view metrics
   - Then I see the share of swims verified, flagged, rejected, duplicate and disputed, and the median time from upload to decision
4. **Fairness by start**
   - Given teams chose different starts
   - When I open "Fairness"
   - Then I see progress and finish rate by start, team size and active members
5. **No personal data**
   - Given the metrics
   - When I read them
   - Then they are aggregated and show no GPS data or emails

## Out of scope
- Platform-wide analytics (S-81).
