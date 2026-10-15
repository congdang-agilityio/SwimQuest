---
source: "requirement/account-and-roles.md"
retrieved: 2026-10-15T00:37:38Z
converter: copy
---

# Accounts, Authentication and Permissions

## Account features
- Sign up with email/password and/or supported identity provider; provider choice is a product decision to validate against the current architecture.
- Email verification where supported.
- Login, logout, password reset and session expiration.
- Profile: display name, avatar, optional bio, preferred units and privacy settings.
- Account deletion/export policy should be defined before public launch.
- Do not expose email addresses by default to other players.

## Roles
- `PLAYER`: personal profile, join public tournaments, request/join teams, submit own activity.
- `TEAM_CAPTAIN`: player plus team management, invites, membership actions and start selection before lock.
- `TOURNAMENT_ORGANIZER`: create/manage owned tournaments, registration, team roster and tournament reporting.
- `PLATFORM_ADMIN`: platform-level moderation and exceptional overrides with audit.
A user can hold multiple scoped roles. Organizer role does not automatically grant platform-admin access.

## Permission rules
- Enforce authorization server-side on every protected operation.
- A player may not submit another player's activity unless a specifically approved delegated workflow exists.
- Captains cannot alter verified scoring records.
- Organizers cannot silently change active-season route baselines or rewrite activity verification.
- Admin override requires reason, actor, timestamp, old/new values and audit event.

## Account states
`PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `DELETION_PENDING`, `DELETED` as applicable to the selected auth provider.
Use generic login failure messages to reduce account enumeration.


## Strava sign-in option (OAuth)

Add **Continue with Strava** as an optional sign-in / account-linking method, subject to current Strava API and branding requirements.

### User experience
- Show Strava alongside the other configured identity providers on signup/login.
- First-time Strava authorization may create a SwimQuest account after the user reviews the required consent and the app obtains the minimum identity data permitted by Strava.
- If a SwimQuest account already exists, provide an explicit account-linking flow from Profile / Settings. Do not silently merge accounts based on a matching email address.
- Existing users must be able to unlink Strava if another login method remains available, to avoid account lockout.
- Explain separately whether the user is signing in or authorizing access to activity data. Sign-in does not automatically mean the app has all permissions needed to read activities.
- Handle cancellation, denied consent, expired/revoked tokens, provider errors, and relinking.

### Security and account mapping
- Use the supported OAuth authorization-code flow with server-side code exchange and state/CSRF validation; use PKCE if supported and appropriate for the selected client architecture.
- Keep client secrets and refresh/access tokens on the server or in a secure token vault; never ship a client secret in the PWA.
- Store Strava athlete/provider ID as a provider subject and enforce uniqueness. Do not use display name as identity.
- Do not silently merge accounts by email. If account linking is ambiguous, require authentication to the existing SwimQuest account first.
- Request only the scopes needed for the chosen feature. Keep identity scopes and activity access scopes conceptually separate.
- Log provider connection status and scope grants, not raw tokens. Support revocation/disconnection and secure token deletion.
- Recheck the current Strava API terms, OAuth guidance, scopes, rate limits, brand guidelines, and data-display/storage rules before implementation; do not assume any particular scope or permission is available without verification.

### Important product distinction
**Strava login is authentication; Strava activity access is a separate authorization/integration.** A player may be able to sign in with Strava without granting SwimQuest permission to import activities. Route progress must still use the existing verification rules and must not award progress merely because an account is linked.


## Player profile management requirements

The player has a dedicated profile/settings area for:
- Basic profile fields and avatar;
- Swimming preferences and verified performance summaries;
- Tournament/team participation and earned badges;
- Connected identity providers, including Strava;
- Privacy controls and notification preferences;
- Security and account recovery options;
- Account data export/deletion request.

Only verified activity contributes to verified performance summaries. Keep user-entered goals distinct from actual verified stats. Email is private by default. Do not display precise GPS, raw trackpoints or sensitive provider tokens. Profile visibility must be enforced by the API, not only hidden in the UI.
