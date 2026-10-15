---
source: "requirement/tournaments-and-teams.md"
retrieved: 2026-10-15T00:37:38Z
converter: copy
---

# Tournament and Team Design

## Create tournament fields
Required: name, description, registration opens/closes, season starts/ends, visibility, join policy, max team size, scoring version, route configuration and organizer.
Optional: banner artwork, rules URL, eligibility notes, invite code, tournament logo and contact channel.
Validation: end date after start date; registration window valid; team size within configured limits; all route baselines present; exactly one finish destination; no active config mutation without versioning.

## Visibility and joining
- `PUBLIC`: discoverable; players can request or directly join depending on join policy.
- `UNLISTED`: accessible by direct link/code.
- `PRIVATE`: invitation only.
Join policies: open, approval required, invite only. Do not permit bypass of tournament capacity or eligibility constraints.

## Team features
- Create team inside a tournament or via tournament flow.
- Team name, emblem/avatar, short description and roster.
- Invite via link/code; revoke expired or unused invites.
- Join request, approve/reject if policy requires.
- Leave team before lock; post-lock transfer policy must be explicit to prevent score exploits.
- Team captain handover with audit.
- Prevent duplicate team membership in the same tournament unless the rules explicitly permit it.

## Tournament organizer console
- Draft/publish controls
- Registration and team roster
- Start selection completion/lock status
- Tournament timeline
- Verification/dispute queue link
- Progress and participation dashboard
- Export/reporting with privacy controls
- Audited close/archive action
