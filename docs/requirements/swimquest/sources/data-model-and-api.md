---
source: "requirement/data-model-and-api.md"
retrieved: 2026-10-15T00:37:39Z
converter: copy
---

# Logical Data Model and API Contracts
Adapt to existing project schema after repository inspection. These are logical concepts, not instructions to duplicate existing entities.

## Entities
### User / Profile
`id`, auth-provider subject, display name, avatar key, preferences, privacy settings, status, timestamps.

### Tournament
`id`, owner/organizer ID, name, description, visibility, join policy, status, registration window, start/end dates, max team size, scoring version, route config version, timestamps.

### TournamentMembership
`id`, tournament ID, user ID, status (`REQUESTED|ACTIVE|REJECTED|LEFT|REMOVED`), role scope, joined timestamp. Unique active membership as required by policy.

### Team
`id`, tournament ID, name, emblem key, description, captain ID, status, timestamps.

### TeamMembership
`id`, team ID, user ID, role (`CAPTAIN|MEMBER`), status, joined_at. Enforce tournament/team membership invariants.

### TeamInvitation
`id`, team ID, invited by, token hash, expiry, status, accepted_by, accepted_at. Never store raw reusable invite tokens if a hash suffices.

### RouteDestination
`id`, stable slug, display name, order, `is_finish`, art key, active.

### SeasonRouteConfig
`id`, tournament/season ID, start destination ID, route length units, config version, locked timestamp, created_by.

### TeamSeasonRoute
`id`, team ID, season ID, start destination ID, selection timestamp, lock timestamp, eligible units, progress cache, finish timestamp, status. Unique team + season.

### ActivitySubmission / Verification / ScoreLedger / AuditEvent
Reuse existing equivalents. Maintain immutable source references, idempotency keys, scoring version and reversal/audit history.

## Suggested REST API
Identity endpoints may be delegated to the auth provider; do not implement custom password handling if existing provider covers it.
- `GET /me`
- `PATCH /me/profile`
- `GET /tournaments?status=&visibility=`
- `POST /tournaments`
- `GET /tournaments/:id`
- `PATCH /tournaments/:id` (owner and permitted states only)
- `POST /tournaments/:id/publish`
- `POST /tournaments/:id/join`
- `POST /tournaments/:id/leave`
- `GET /tournaments/:id/teams`
- `POST /tournaments/:id/teams`
- `POST /teams/:id/invitations`
- `POST /teams/invitations/:token/accept`
- `POST /teams/:id/join-requests`
- `POST /teams/:id/members/:userId/approve`
- `GET /seasons/:id/route`
- `PUT /seasons/:id/teams/:teamId/start-destination`
- `GET /seasons/:id/teams/:teamId/route`
- `GET /seasons/:id/route-leaderboard`
- Existing activity submission/verification endpoints remain source of eligible contributions.

## API invariants
- Server enforces RBAC, state transitions and capacity.
- Create/publish/join/start selection should be idempotent where possible.
- Start selection transactional and immutable after lock.
- Tournament route baselines cannot be silently changed after season starts.
- Do not return precise GPS data to general profile/tournament endpoints.
- Use stable error codes and consistent pagination.


## Strava OAuth / identity linking
Adapt routes to the chosen auth provider; do not build a parallel auth system if the existing provider supports federated identity.
- `GET /auth/strava` — start OAuth flow and generate/record state.
- `GET /auth/strava/callback` — validate state, exchange authorization code server-side, resolve provider subject, then sign in or create account according to explicit account-linking rules.
- `POST /me/identity-providers/strava/link` — authenticated account-linking initiation.
- `DELETE /me/identity-providers/strava/link` — unlink only if another valid sign-in method remains.
- Activity-data authorization/refresh endpoints, if needed, must be separate from sign-in endpoints.

Store provider subject and connection metadata; never expose client secrets or tokens to the browser. Verify current Strava scopes and API policies before implementation.


## Player profile management endpoints

Adapt to existing conventions and authorization:
- `GET /me/profile` — current user's editable profile.
- `PATCH /me/profile` — update allowed profile fields with validation.
- `GET /players/:playerId/profile` — public/member-visible profile projection only; never return private fields by default.
- `GET /me/stats` — verified player statistics and tournament/team summaries.
- `GET /me/activity-history` — paginated activity history and verification state, scoped to the current user.
- `GET /me/connections` — provider connection metadata and granted capability summary, never raw tokens.
- `POST /me/connections/strava/link` — initiate explicit account link or activity authorization flow as appropriate.
- `DELETE /me/connections/strava` — disconnect only after checking account recovery and active integration requirements.
- `GET /me/preferences` / `PATCH /me/preferences` — privacy, display units and notification preferences.
- `POST /me/data-export-requests` — create export request if supported by policy.
- `POST /me/deletion-requests` — start account deletion workflow with re-authentication/confirmation.

Server-side rules:
- Profile writes may affect only the authenticated user's own fields unless a privileged moderation action exists.
- Public profile endpoint returns a privacy-filtered DTO/projection.
- Verified stats are derived from the scoring/activity system, not user-editable.
- Do not expose email, precise GPS, raw provider tokens or internal moderation notes.
- Log security-sensitive connection and account-lifecycle changes.
