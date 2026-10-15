# PRD: SwimQuest (full platform + Route 01), release 1

- Slug: `swimquest` · Analysis: `requirements.md` (signed off 2026-10-15 by congdang-agilityio; re-signed 2026-10-15 for the post-GATE-2 change Q-56, Q-57, Q-58, A-28, A-29) · Version: 2
- Epic title: SwimQuest release 1: team swimming expedition platform (Route 01)

## 1. Summary
SwimQuest is a mobile-first web app (PWA) in which players join tournaments, are placed in
organizer-created teams, upload their verified swims as GPX/FIT files and earn points that move
their team's ship along Route 01 from a chosen beach to the shared finish at Lý Sơn. Release 1
contains everything in the design pack (Q-01), with the limits the stakeholder set, and is
deployed to staging for a closed pilot of under 100 players (Q-29, NFR-18). Stories are ordered
so a thin playable core reaches staging first (A-10); nothing is cut.

## 2. Goals and success metrics
Metrics come from SRC-10 §Metrics. No numeric targets were given (G-21, Q-29).
| Goal | Metric | Target |
|---|---|---|
| Players can get from sign-up into a team | Sign-up completion; join conversion (link opened → team chosen) | Not set |
| Organizers can run a tournament end to end | Tournament create-to-publish conversion; tournaments reaching COMPLETED | Not set |
| Swims are verified quickly and fairly | Verification pass / flagged / duplicate / dispute rates; median verification latency | Not set |
| Teams keep swimming | Weekly active swimmers; team participation; finish rate by start | Not set |
| Pilot runs on staging | Closed pilot of under 100 players plays on staging (NFR-17, NFR-18) | < 100 players |

## 3. Users
Visitor, Player, Team captain, Tournament organizer, Review helper, Platform admin (actors in
`requirements.md` §2). External: Zalo (organizer's own bot posting to a group). Strava, Google,
Facebook, Garmin, Coros and Suunto appear only as "coming soon".

## 4. Scope
- **In this release (all confirmed FRs):**
  - Accounts: FR-01 email/password/display-name sign-up without verification, FR-03 login,
    logout, change password, admin password reset, FR-04 and FR-64 "coming soon" sign-in
    buttons, FR-07 account states, FR-08 generic login errors, FR-09 roles.
  - Profile: FR-11 to FR-19 (My Profile, basic info, swim goals, verified stats, history,
    privacy, notification preferences, security, editor states).
  - Tournaments: FR-21 to FR-30, FR-70, FR-73, FR-74, FR-78 (except item 4), FR-80, FR-85.
  - Teams: FR-31, FR-32, FR-34, FR-35, FR-36, FR-75, FR-76, FR-81.
  - Route 01: FR-37 to FR-43, FR-84.
  - Swims, checks, scoring: FR-44, FR-45, FR-46, FR-47, FR-48, FR-49, FR-50, FR-51, FR-52,
    FR-65, FR-67 (Connect section: upload works, others "coming soon"), FR-68, FR-71, FR-72,
    FR-82.
  - Notifications, admin, analytics: FR-53, FR-54, FR-55, FR-56, FR-57, FR-58, FR-83.
  - UI, art, assets: FR-59, FR-60, FR-61, FR-62, FR-63, FR-69, FR-77.
  - All NFRs in §5, except the deferred part of NFR-06 and the later-release NFR-03, NFR-04.
- **Out / later:**
  - Deferred until before a production launch (stakeholder agreed): data export and account
    deletion (FR-10, Q-18), retention and analytics-consent policies (NFR-06, Q-18), minimum
    age and minors (Q-28). Deletion-related account states (deletion pending, deleted) are
    only used once deletion is built.
  - Later release: working Strava, Google and Facebook sign-in and account linking (FR-04,
    FR-05, FR-06, FR-64 beyond the buttons; Q-33; NFR-03, NFR-04); Strava, Garmin, Coros and
    Suunto activity import (FR-67 beyond "coming soon"; Q-34); manual swim entry with review
    and the "manual entries allowed" setting (FR-66, FR-78 item 4, BR-19; Q-38).
  - Dropped: email verification (FR-02, Q-01), public handles (FR-20, Q-30), team join
    requests and approvals (FR-33, Q-49).
  - Out: native store apps (Q-02), Apple sign-in (Q-05), email notifications and any email
    sending (Q-17, Q-39), self-service password reset (Q-39), yards/miles (Q-23),
    per-tournament time zones (Q-24), system-checked eligibility rules (Q-27), translating
    organizer texts (Q-40), real-world navigation and public precise GPS (SRC-3), repository
    assessment and migration of an existing system (Q-32, C-01).

## 5. Requirements
| ID | Summary | Decided by |
|---|---|---|
| FR-01 | Sign up with email, password, display name; active at once | Q-01, Q-05, Q-30 |
| FR-03 | Login, logout, change own password, session expiry; admin resets forgotten passwords | Q-39 (A-25) |
| FR-04, FR-64 | Strava, Google, Facebook "coming soon" buttons only | Q-05, Q-33 |
| FR-07 | Account states; suspended accounts blocked | Q-01 |
| FR-08 | Generic login failure message | Q-01 |
| FR-09 | Server-side scoped roles; organizer/admin functions shown by role | Q-02, Q-08, Q-35 (A-07) |
| FR-11 to FR-19 | My Profile page, basic info, swim goals, verified stats, history, privacy, notification preferences, security, editor states | Q-01, Q-17, Q-23, Q-31, Q-39 |
| FR-21, FR-22, FR-23 | Create tournament draft with season start/end as date and time (Vietnam time, pre-filled 00:00/23:59), validate, preview, publish, lifecycle (ACTIVE at the start time, COMPLETED at the end time) | Q-08, Q-10, Q-11, Q-21, Q-22, Q-25, Q-56, Q-58 |
| FR-24 | Edit only by owner in permitted states; active config locked/audited | Q-01 |
| FR-25, FR-27 | "Public" or "Invite link only"; discover public tournaments | Q-21 |
| FR-26, FR-28, FR-80 | Invite link; choose a team with room; join at once; capacity never exceeded | Q-22, Q-27, Q-45, Q-49, Q-50, Q-53 (A-17, A-22) |
| FR-29 | Organizer console (automatically assigned starts marked) | Q-01, Q-57 |
| FR-30 | Several tournaments; one swim counts in each, status per tournament | Q-09, Q-27, Q-42 |
| FR-31, FR-76, FR-81 | Organizer creates teams with limits, appoints captains; captain edits team | Q-11, Q-45, Q-46 |
| FR-32 | Captain invites with team preselected | Q-46, Q-49 |
| FR-34, FR-35, FR-36, FR-75 | Team changes, removals, handover, one team per tournament, organizer moves | Q-11, Q-12, Q-46, Q-50, Q-53 (A-23) |
| FR-37 to FR-43 | Route 01, start choice and lock (default at the season start time), equal route distance, points-based progress, finish, map | Q-06, Q-13, Q-24, Q-25, Q-43, Q-46, Q-48, Q-51, Q-57, Q-58 (A-18) |
| FR-84 | A team with no start at the deadline gets the least-chosen start, ties at random; audited as a system action; team notified; shown as "assigned automatically"; locked | Q-57 (A-28) |
| FR-44, FR-65, FR-67 | Swims by GPX/FIT upload only; Connect section | Q-03, Q-34, Q-38 (A-20) |
| FR-45, FR-46, FR-68 | Verification lifecycle, duplicates, standard automatic checks (swim start time inside the season; pace and distance inside the tournament's realistic swim limits, else flagged) | Q-04, Q-36, Q-37, Q-56, Q-58 |
| FR-47 | Revoking a swim reverses points, XP, multiplier, finish | Q-13, Q-43 |
| FR-48, FR-71 | Per-tournament status, disputes, review queue, review helpers | Q-35, Q-38, Q-41, Q-42 |
| FR-49 | Scoring rules | Q-43, Q-48 |
| FR-50 | Leaderboard tabs Progress, Points, Total km, Badges | Q-26 (A-21) |
| FR-51, FR-82 | XP, 8 badges, ship tiers, levels, collectibles | Q-15, Q-16, Q-51, Q-52 |
| FR-52 | Team dashboard; teammates see contributions | Q-31 |
| FR-53 | In-app and PWA push notifications (including a start assigned automatically) | Q-17, Q-57 |
| FR-54, FR-55 | Admin reports, overrides with reason; audit trails (including automatic start assignments and swim-limit defaults/bounds) | Q-01, Q-56, Q-57 |
| FR-56, FR-57 | Funnel events; organizer metrics and fairness view | Q-01 |
| FR-58 | Safety messaging and reporting | Q-01 |
| FR-59, FR-60 | 23 screens with states; bottom nav Home, Tournaments, My Team, Voyage, Profile | Q-01, Q-20 |
| FR-61, FR-62, FR-77 | Art cut from the concept image plus vector stand-ins; manifest; replacement list | Q-19, Q-47 (A-14) |
| FR-63 | Welcome page | Q-01 |
| FR-69 | Vietnamese and English, Vietnamese default; Zalo Vietnamese only | Q-07, Q-40, Q-55 |
| FR-70 | 3 tournaments per account lifetime; admin-approved requests for more | Q-08 (A-11) |
| FR-72, FR-74, FR-78 | Extra swim rules (stricter than the tournament's realistic limits; missed = does not count), tournament rules, settings with defaults, including realistic swim limits (item 9: 1:05 and 5:00 per 100 m, 30 km; locked at season start) | Q-10, Q-36, Q-41, Q-44, Q-48, Q-56, Q-57, Q-58 (A-12) |
| FR-85 | Admin sets the default realistic swim limits and the platform-wide sanity bounds; audited; existing tournaments unchanged | Q-56 (A-29) |
| FR-73 | Route chosen from a list (Route 01 only) | Q-10 |
| FR-83 | Optional Zalo group bot per tournament | Q-17, Q-54, Q-55 (A-24) |
| NFR-01 to NFR-21 | Platform (PWA), security, privacy, safety, data integrity, audit, accessibility, visual, assets, API, operations, evidence, i18n, scale, staging, Zalo key secret, Vietnam time, metric units | see `requirements.md` §4 |

Cross-cutting (every story): Vietnamese and English text with Vietnamese as default (FR-69,
NFR-16); Vietnam time UTC+7 for dates, days and weeks (NFR-20); metric units (NFR-21);
server-authoritative rules and roles (NFR-02, FR-09); accessibility (NFR-10); safe copy
(NFR-07); audit of privileged actions (NFR-09).

## 6. Key decisions
| Question | Decision |
|---|---|
| Q-01 | Release 1 = everything in the design pack, staging, email sign-up without verification |
| Q-02 | Web only (PWA); organizer/admin in the same app by role |
| Q-03, Q-34, Q-38 | GPX/FIT upload is the only intake; other sources "coming soon"; no manual entry |
| Q-04, Q-36, Q-37 | Automatic standard checks; failures go to review; pool and open water equal |
| Q-56 | Realistic swim limits per tournament, set by the organizer, pre-filled with platform defaults (1:05, 5:00 per 100 m, 30 km), inside admin-set bounds, locked at season start; outside = flagged for review; extra rules stay "does not count, dispute only" |
| Q-57 | A team with no start at the deadline gets the start the fewest teams have, ties at random; audited, notified, shown "assigned automatically", locked |
| Q-58 | Season start and end are a date and time (Vietnam time, pre-filled 00:00/23:59); a swim is in the season by its start time; start-choice deadline defaults to the season start time; upload days after the season count from the end time |
| Q-05, Q-33 | Email/password only; Strava/Google/Facebook as "coming soon" buttons |
| Q-06, Q-25 | Same route distance for every start; organizer enters it per tournament |
| Q-07, Q-40 | Vietnamese and English; Vietnamese default; organizer text as typed |
| Q-08 | Any player can create up to 3 tournaments; more with admin approval |
| Q-09, Q-42 | One swim counts in every tournament; each tournament reviews for itself |
| Q-10, Q-44 | Organizer picks the route (Route 01 only) and sets rules and eight settings with defaults |
| Q-11, Q-45, Q-49 | Organizer creates teams and captains; one invite link; choosing a team with room joins at once |
| Q-12, Q-50, Q-53 | Players cannot leave/switch after the start; organizer moves (swims move) and removals stay allowed |
| Q-13 | A team below 100% loses its finish until it returns |
| Q-15, Q-51 | 8 badges with the accepted rules; share achievement picture and link |
| Q-16, Q-52 | Ship tiers, levels and collectibles |
| Q-17, Q-54, Q-55 | In-app and push notifications; optional organizer Zalo bot posting in Vietnamese |
| Q-19, Q-47 | Art cut from the concept image plus vector stand-ins; replacement list |
| Q-20 | Bottom nav Home, Tournaments, My Team, Voyage, Profile |
| Q-21 | "Public" or "Invite link only" |
| Q-22 | One date range; joining from publishing until season end |
| Q-23, Q-24 | Metric only; Vietnam time |
| Q-26 | Leaderboard tabs Progress, Points, Total km, Badges |
| Q-27 | No eligibility rules, only free-text notes |
| Q-29 | Closed pilot under 100 players |
| Q-30, Q-31 | No handle; teammates always see contributions |
| Q-35, Q-41 | Organizer or appointed helpers review; missed extra rule does not count, can be disputed |
| Q-39 | Admin resets passwords; no reset email |
| Q-43, Q-48 | Accepted scoring; points move the ship; route length in points; one daily limit (10 km) |
| Q-46 | Captain powers with organizer override |
| Q-32 | No repository assessment; GATE 1 and GATE 2 authorize building |
| GATE 2 round 1 (2026-10-15) | Progress ties below 100%: the team that reached that progress first ranks higher (FR-50). Story readings accepted: swim type handled like a missed extra rule, multiplier streak, visibility changeable after publishing, team without captain until the organizer appoints one, reviewers see the track, ship-tier effect, reduced motion, last admin keeps the role. |
| GATE 2 round 2 (2026-10-15, after the GATE 1 re-sign) | Answers 1, 2 and 4 applied as Q-56, Q-57, Q-58: new stories S-93 (organizer sets realistic swim limits) and S-94 (automatic start, P0); S-64 becomes "admin sets defaults and bounds"; S-04, S-06, S-09, S-10, S-12, S-24, S-26, S-27, S-28, S-32, S-33, S-37, S-65, S-66 revised |

## 7. Assumptions, deferred items and risks
- Remaining assumptions (each accepted at GATE 1): A-03 one season per tournament; A-05 written
  specs win over the concept image; A-07 first admin set up by the operator, admins grant the
  role in-app; A-09 pilot on staging; A-10 playable core first; A-11 every created tournament
  counts toward the limit, each approval allows one more; A-12 extra rules = minimum distance
  and slowest pace; A-14 four strokes; A-15 no solo play outside teams; A-17 full team cannot
  be chosen, at least one team to publish, link can be switched off/replaced; A-18 team told
  when its finish is withdrawn, new finish time used for ties; A-20 manual entry not shown;
  A-21 Total km and Badges tab meanings; A-22 preselected team can be changed; A-23 removed
  player cannot rejoin through the link; A-24 players told about the Zalo group; A-25 admin
  password reset steps; A-26 a swim belongs to the day it started (daily limit, long-swim
  bonus); A-27 display name editable, not unique. Accepted at the re-sign: A-28 several teams
  without a start are assigned one at a time in random order; A-29 changing platform swim-limit
  defaults or bounds affects only tournaments created afterwards.
- Deferred: Q-18 (export, deletion, retention, analytics consent), Q-28 (minimum age, minors).
- Risks: R-02 very large scope (mitigated by story order), R-03 art quality of cut-outs,
  R-07 edited GPX/FIT files, R-09/R-11 no email verification, R-12 per-tournament status
  confusion, R-13 organizer moves can shift finishes, R-14 points move ships faster than km,
  R-15 players without GPX/FIT export cannot take part, R-16 Zalo in-app browser, R-17 iPhone
  push limits, R-18 Zalo group visibility.

## 8. Story map
P0: thin playable core (A-10), in delivery order:
S-01 Sign up with email, password and display name · S-02 Log in and log out · S-03 App
navigation and home page · S-04 Create a tournament draft · S-05 Organizer creates teams with
member limits · S-06 Publish a tournament and get its invite link · S-07 Join a tournament
through its invite link by choosing a team · S-08 Organizer appoints and changes a team captain · S-09
Captain chooses the team's Route 01 start · S-10 Season start: tournament becomes active and the
start choice locks · S-94 A team with no start at the deadline gets one automatically · S-11 Upload a GPX or FIT swim file · S-12 Automatic checks verify or flag
an uploaded swim · S-13 Verified swims earn distance points · S-14 The team's ship moves along
the Route 01 map · S-15 Team leaderboard: Progress tab · S-16 My swims: history with status per
tournament · S-17 My Team page with roster and contributions · S-18 Art: Route 01 map,
landmarks and ships

P1: the rest of the game, organizer tools, profile and admin:
S-19 to S-77 and S-93 (finish, bonuses, multiplier, leaderboard tabs, tournament settings and
rules including realistic swim limits,
visibility and discovery, lifecycle, team management, review and disputes, revocation, badges,
XP and levels, ship tiers, profile, security, language, quota, admin, notifications, context
switcher, welcome page, safety, app states, art sets, asset replacement list)

P2: secondary features:
S-78 to S-92 (audit log view, roster export, organizer metrics, funnel events, share
achievement, collectibles, Zalo bot, Connect "coming soon" list, "coming soon" sign-in buttons,
asset manifest and QA gallery)

Full ordered list with priorities: `stories.md`.
