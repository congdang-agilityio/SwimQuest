# S-81: Product funnel events and platform metrics

- **Priority:** P2
- **Covers:** FR-56, NFR-06, NFR-17 · **Decisions:** Q-01, Q-18 (deferred part)
- **Depends on stories:** S-62

## User story
As a platform admin, I want the key product events recorded and summarised, so that we can see where pilot players drop off.

## Acceptance criteria
1. **Events recorded**
   - Given players sign up, set up their profile, create, publish, view and join tournaments, join teams, choose and lock starts, upload swims, get verification results, move progress and finish
   - When each happens
   - Then a matching funnel event from SRC-10 is recorded once
2. **Minimal data**
   - Given an event is recorded
   - When it is inspected
   - Then it holds no email, GPS or raw track data
3. **Funnel summary**
   - Given events exist
   - When I open "Metrics" in the admin area
   - Then I see counts and conversion between the main steps (sign-up, join, first swim, finish)
4. **Health signals**
   - Given the app is in use
   - When I open Metrics
   - Then I see API failures and asset loading failures counts
5. **Score and override events**
   - Given scores are recalculated or an admin override happens
   - When I look at the events
   - Then they are recorded

## Out of scope
- Analytics consent (deferred, Q-18).

## Notes
- Events without a release 1 equivalent (`account_verification_completed`, `tournament_join_requested`, `team_created` by players, `team_invite_*`) are mapped or skipped as follows: email verification and join requests do not exist (Q-01, Q-49); `team_created` is the organizer creating a team; `team_invite_sent` / `team_invite_accepted` map to a captain sharing a team link and a player joining through it (BA reading).
