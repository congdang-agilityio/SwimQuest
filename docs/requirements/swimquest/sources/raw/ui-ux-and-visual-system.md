# UI/UX and Visual System

## Product navigation
Mobile bottom navigation: Home, Tournaments, My Team, Voyage, Profile.
Desktop: left navigation or top navigation with tournament context switcher.

## Required screens
1. Marketing/welcome screen
2. Sign up
3. Login
4. Email verification / password reset
5. Profile setup/edit
6. Tournament discovery/search/filter
7. Tournament details and rules
8. Create tournament wizard
9. Organizer tournament dashboard
10. Join tournament / request approval / invitation
11. Create team
12. Team page, roster, invites and requests
13. Select Route 01 start destination
14. Confirmation and locked selection state
15. Route map with seven destinations and team progress
16. Activity submission and verification status
17. Activity history / dispute status
18. Team progress dashboard
19. Tournament leaderboard
20. Player profile, XP and badges
21. Organizer analytics / verification review
22. Settings, privacy and account lifecycle
23. Empty, loading, error, offline and access-denied states

## Core UI flows
- First-time user: Welcome → Sign up → Verify → Profile → Browse tournaments.
- Organizer: Create tournament draft → configure → preview → publish → manage registrations/teams → open season.
- Player: Tournament details → join/request/invite → create/join team → submit activity.
- Captain: Team setup → invite members → choose start → confirm → lock → follow route.
- Swim: Submit activity → pending verification → verified/rejected → score ledger updates → progress map updates.
- Finish: 100% verified normalized progress → finish event → reward/badge → shareable summary with privacy controls.

## Art direction
Premium stylized 2.5D ocean adventure; painterly island scenes with crisp, readable UI. Palette:
- Deep Navy `#062B46`
- Deep Sea `#003B66`
- Ocean Blue `#00AEEF`
- Turquoise `#20C8C2`
- Coral `#FF6B6B`
- Sand `#F5E6C8`
- Gold `#FFD166`
- Foam `#F4FBFF`

Use consistent upper-left sunlight, clear silhouettes, restrained glow, strong mobile contrast, generous spacing and clear hierarchy. UI text must not be embedded in raster illustrations. Do not rely on color alone for state. Touch targets at least 44×44 CSS px.

## Art asset status
The included concept board is for visual direction only. Production UI components, isolated sprites, route landmarks and animation atlases still need to be created and reviewed. Never slice the concept board and claim it is production-ready.


## Player Profile Management — dedicated page

Add a dedicated **My Profile** page, reachable from the main navigation and account menu. It is a first-class platform area, not only a small edit form.

### Profile overview
- Avatar and cover/banner (optional)
- Display name and unique public handle, if the product chooses to support handles
- Short bio and optional location at city/region level only
- Swim preferences / preferred units
- Player stats: verified swim activities, verified distance, active days, tournaments joined, teams, Route 01 progress and earned badges
- Recent activity history with verification status; show only data the player is authorized to see
- Public profile preview so the player can inspect what other tournament members can see

### Editable sections
1. **Basic information:** display name, avatar, bio, optional city/region.
2. **Swimming profile:** preferred units, swim goals and optional preferred disciplines. Goals must not encourage unsafe volume or pace.
3. **Connected accounts:** Strava connection status, connect/reconnect/disconnect actions and clear separation between Strava sign-in and activity-data authorization.
4. **Privacy:** public/member-only/private visibility controls for profile fields and activity summaries; email is private by default; precise GPS and raw trackpoints are never public.
5. **Notifications:** tournament invitations, team updates, verification results and milestone notifications.
6. **Security:** login methods, password reset where applicable, active sessions if supported, account recovery.
7. **Account lifecycle:** export/delete request and confirmation, with policy-compliant retention and audit handling.

### UX and validation
- Separate View Profile and Edit Profile modes.
- Save/cancel controls, field validation, character limits and clear success/error feedback.
- Warn before leaving with unsaved changes.
- Use optimistic UI only for non-sensitive cosmetic fields; server remains authoritative.
- Handle missing avatar, loading, empty history, API errors and offline states.
- Responsive mobile-first layout with desktop-friendly settings navigation.
- Accessibility: labeled inputs, keyboard navigation, visible focus and non-color-only status indicators.
