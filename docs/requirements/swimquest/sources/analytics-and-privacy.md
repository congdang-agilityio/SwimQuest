---
source: "requirement/analytics-and-privacy.md"
retrieved: 2026-10-15T00:37:40Z
converter: copy
---

# Analytics, Privacy and Safety

## Product funnel
- `account_signup_started`, `account_signup_completed`, `account_verification_completed`
- `profile_setup_completed`
- `tournament_create_started`, `tournament_created`, `tournament_published`
- `tournament_viewed`, `tournament_join_requested`, `tournament_joined`
- `team_created`, `team_invite_sent`, `team_invite_accepted`
- `route_start_options_viewed`, `route_start_selected`, `route_start_locked`
- `activity_submitted`, `activity_verification_passed`, `activity_verification_failed`
- `route_progress_changed`, `route_finish_reached`
- `score_recalculated`, `admin_override`

## Metrics
- Signup completion and verification rates.
- Profile setup completion.
- Tournament creation-to-publish conversion.
- Tournament join conversion and registration drop-off.
- Team creation, invitation acceptance and roster participation.
- Activity verification pass/rejection/duplicate/dispute rates.
- Median verification latency.
- Weekly active swimmers and team participation.
- Route progress and finish rate by start baseline, team size and active members.
- Client performance, API failures and asset loading failures.

## Privacy
- Collect only data needed for product operations.
- Do not expose email addresses, precise GPS or raw trackpoints publicly.
- Keep analytics aggregated where possible.
- Define retention and deletion policies.
- Role-based access for organizer exports and moderation.
- Audit privileged actions and scoring changes.

## Safety
- No incentives for unsafe volume, pace, night swimming or solo open-water swimming.
- Avoid presenting stylized route maps as safe real-world directions.
- Provide reporting/dispute mechanisms and safety messaging.
