# SwimQuest — Product GDD (Platform + Route 01)
Version 2.0 | Design scope

## 1. Product vision
SwimQuest turns verified swimming activity into a shared team expedition. Players join a tournament, create or join a team, log verified swims, and see their team's progress through a stylized ocean world. Organizers can run multiple tournaments and seasons.

## 2. Platform modules
Identity providers include email/password or supported provider login, with **Strava OAuth sign-in as an optional choice**. Strava activity import permissions are a separate consent/integration step.
1. Identity and account management
2. Player profile and dedicated profile management page (basic information, swimming stats, connected accounts, privacy, notifications, security and account lifecycle)
3. Tournament creation and administration
4. Tournament discovery and registration
5. Teams, invitations and membership
6. Activity submission and verification
7. Route 01 expedition map
8. Progress, leaderboards, XP and badges
9. Notifications and activity history
10. Admin audit, analytics and safety controls

## 3. Core user journeys
### New player
Landing page → register/login → verify email where applicable → profile setup → browse tournaments → join tournament → create team or accept invitation → participate in Route 01 → submit swim → wait for verification → receive progress update.

### Organizer
Register/login → create tournament draft → configure name, description, dates, eligibility, team size, privacy, scoring version and route → preview → publish/open registration → monitor applications/teams → lock registration → start season → review disputes and metrics → close/archive tournament.

### Team captain
Create or join tournament → create team → set name/avatar/description → invite members → select one Route 01 start point before deadline → confirm selection → selection locks at season start/deadline → track team progress to Lý Sơn.

### Member
Join team by invitation or approved request → connect/use the existing supported activity intake method → submit swim → see verification status → see accepted contribution, team progress and personal history.

### Admin
Manage reports and exceptional cases; use reasoned, audited overrides. Admin powers must not silently rewrite scoring history.

## 4. Tournament lifecycle
`DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED → READY → ACTIVE → COMPLETED → ARCHIVED`
- Only authorized organizer/owner can create and manage tournament.
- A tournament must pass validation before publish.
- Dates, scoring rules and route config are versioned.
- Active tournament configuration changes are restricted and audited.
- Multiple tournaments can coexist, subject to team/player eligibility rules.

## 5. Route 01 locations
1. `non_nuoc` — Bãi biển Non Nước
2. `son_thuy` — Bãi Sơn Thủy
3. `pham_van_dong` — Bãi Phạm Văn Đồng
4. `man_thai` — Bãi Mân Thái
5. `hon_sup` — Hòn Sụp
6. `cu_lao_cham` — Cù Lao Chàm
7. `ly_son` — Lý Sơn (only finish destination)

## 6. Approved route rules
- Each team chooses one start among the first six destinations at season start.
- Start choice locks at the configured deadline/season lock; no routine mid-season changes.
- Lý Sơn is the shared finish and cannot be selected as a start.
- Progress is measured as normalized percentage of each team's configured route baseline.
- Only verified swim activities contribute.
- Personal XP, team route progress, season points and consistency are separate score domains.
- Route map is a game abstraction, not a real-world navigation chart.

## 7. Fairness, safety and privacy
- Route baselines must be published and reviewed before season start.
- Do not rank routes by raw distance when baselines differ.
- Do not reward unsafe distance, pace, night swimming or open-water risk.
- Never expose precise GPS tracks or live swimmer location publicly.
- Keep audit trails for verification decisions, score changes and admin overrides.
- Provide activity dispute/review flow.
