# Stories: SwimQuest release 1

Source: `prd.md` (from `requirements.md`, signed off 2026-10-15, re-signed 2026-10-15 for the
post-GATE-2 change Q-56, Q-57, Q-58). 94 stories, listed in suggested delivery order. S-93 and
S-94 were added by that change; they keep their new IDs and are listed at their delivery
position. Priority expresses the order agreed in A-10, not a scope cut:
- **P0 (S-01 to S-18, plus S-94):** thin playable core on staging: sign up/login → create
  tournament and teams → join via link → captain chooses start (or gets one automatically) →
  upload GPX/FIT → automatic checks → points move the ship → leaderboard.
- **P1 (S-19 to S-77, plus S-93):** the rest of the game, organizer tools, profile, admin,
  notifications, language, safety and the art sets with the asset replacement list.
- **P2 (S-78 to S-92):** audit view, export, metrics, funnel events, sharing, collectibles, Zalo
  bot, "coming soon" lists and the technical asset manifest.

Cross-cutting for every story (not repeated in each): Vietnamese and English text, Vietnamese by
default (FR-69, NFR-16); Vietnam time UTC+7 (NFR-20); metric units (NFR-21); server-side roles
and scoring (FR-09, NFR-02); accessibility (NFR-10); safe copy (NFR-07); audit of privileged
actions (NFR-09).

## Stories
| ID | Title | Priority | ACs | Covers |
|---|---|---|---|---|
| S-01 | Sign up with email, password and display name | P0 | 5 | FR-01, FR-07, FR-69 |
| S-02 | Log in and log out | P0 | 5 | FR-03, FR-08, FR-07 |
| S-03 | App navigation and home page | P0 | 5 | FR-60, FR-09, FR-59 |
| S-04 | Create a tournament draft | P0 | 5 | FR-21, FR-73, FR-40, FR-37, FR-09 |
| S-05 | Organizer creates teams with member limits | P0 | 5 | FR-31 |
| S-06 | Publish a tournament and get its invite link | P0 | 5 | FR-22, FR-23, FR-80 |
| S-07 | Join a tournament through its invite link by choosing a team | P0 | 5 | FR-28, FR-80, FR-26, FR-36 |
| S-08 | Organizer appoints and changes a team captain | P0 | 5 | FR-76, FR-55, FR-09 |
| S-09 | Captain chooses the team's Route 01 start | P0 | 5 | FR-38, FR-37, FR-40 |
| S-10 | Season start: tournament becomes active and the start choice locks | P0 | 5 | FR-23, FR-39, FR-40 |
| S-94 | A team with no start at the deadline gets one automatically | P0 | 5 | FR-84, FR-38, FR-39, FR-55, FR-29 |
| S-11 | Upload a GPX or FIT swim file | P0 | 5 | FR-65, FR-44, FR-67 |
| S-12 | Automatic checks verify or flag an uploaded swim | P0 | 5 | FR-68, FR-45, FR-46 |
| S-13 | Verified swims earn distance points for the player and the team | P0 | 5 | FR-49, FR-30, FR-78, FR-45 |
| S-14 | The team's ship moves along the Route 01 map | P0 | 5 | FR-41, FR-43, FR-37 |
| S-15 | Team leaderboard: Progress tab | P0 | 5 | FR-50 |
| S-16 | My swims: history with status per tournament | P0 | 5 | FR-15, FR-48, FR-30, FR-45 |
| S-17 | My Team page with roster and contributions | P0 | 5 | FR-52, FR-36 |
| S-18 | Art: Route 01 map, landmarks and ships | P0 | 5 | FR-61, FR-43, FR-82 |
| S-19 | Reach Lý Sơn: finish and "HOÀN THÀNH" experience | P1 | 5 | FR-42, FR-41 |
| S-20 | First-swim and long-swim bonuses | P1 | 5 | FR-49 |
| S-21 | Weekly consistency multiplier | P1 | 5 | FR-49 |
| S-22 | Leaderboard: Points, Total km and Badges tabs | P1 | 5 | FR-50, FR-49 |
| S-23 | Tournament settings: longest swim, daily limit and swim type | P1 | 5 | FR-78, FR-74, FR-24 |
| S-24 | Tournament settings: submission deadline and start-choice deadline | P1 | 5 | FR-78, FR-39, FR-74, FR-84 |
| S-25 | Tournament settings: point values | P1 | 5 | FR-78, FR-49, FR-41 |
| S-26 | Set extra swim rules for a tournament | P1 | 5 | FR-72, FR-74 |
| S-27 | Swims that miss an extra rule do not count in that tournament | P1 | 5 | FR-72, FR-48, FR-30, FR-68 |
| S-28 | Tournament details and rules page | P1 | 5 | FR-27, FR-74, FR-78 |
| S-29 | Optional tournament fields and written rules | P1 | 5 | FR-21, FR-78, FR-74 |
| S-30 | Choose "Public" or "Invite link only" | P1 | 5 | FR-25 |
| S-31 | Find public tournaments with search and filter | P1 | 5 | FR-27, FR-28 |
| S-32 | Edit a tournament within its lifecycle rules | P1 | 5 | FR-24, FR-55, FR-40 |
| S-33 | Season end, completion and archive | P1 | 5 | FR-23, FR-29, FR-55 |
| S-34 | Switch off or replace the invite link | P1 | 5 | FR-80 |
| S-35 | Captain invites players with the team preselected | P1 | 5 | FR-32, FR-80 |
| S-36 | Captain edits team details; organizer can override | P1 | 5 | FR-81, FR-55 |
| S-37 | Organizer chooses or overrides a team's start before the lock | P1 | 5 | FR-38, FR-55, FR-84 |
| S-38 | Player leaves or switches team before the start; blocked after | P1 | 5 | FR-28, FR-34, FR-36 |
| S-39 | Organizer moves a player to another team | P1 | 5 | FR-75, FR-34, FR-41, FR-55 |
| S-40 | Captain hands over captaincy | P1 | 5 | FR-35, FR-55 |
| S-41 | Remove a team member before or after the start | P1 | 5 | FR-35, FR-34, FR-55 |
| S-42 | Organizer adds a player to a team | P1 | 5 | FR-75, FR-35, FR-55 |
| S-43 | Review queue: decide flagged swims | P1 | 5 | FR-45, FR-48, FR-71, FR-55, FR-30 |
| S-44 | Dispute a swim's result | P1 | 5 | FR-48, FR-72, FR-58 |
| S-45 | Organizer appoints review helpers | P1 | 5 | FR-71, FR-09, FR-55 |
| S-46 | Revoke a verified swim | P1 | 5 | FR-47, FR-45, FR-55, FR-41 |
| S-47 | Finish withdrawn when a team drops below 100% | P1 | 5 | FR-42, FR-47 |
| S-48 | Badges: Participation, Conqueror and Perseverance | P1 | 5 | FR-51 |
| S-49 | Badges: Explorer, Teamwork and Lý Sơn | P1 | 5 | FR-51, FR-42 |
| S-50 | Badges: Season and Special | P1 | 5 | FR-51, FR-55 |
| S-51 | XP and levels | P1 | 5 | FR-51, FR-82 |
| S-52 | Ship tiers follow team progress | P1 | 5 | FR-82 |
| S-53 | My Profile page: view and edit basic info | P1 | 5 | FR-11, FR-12 |
| S-54 | Swimming profile: goals and preferred disciplines | P1 | 5 | FR-13 |
| S-55 | Verified stats and badges on the profile | P1 | 5 | FR-14, FR-51 |
| S-56 | Privacy settings and public profile | P1 | 5 | FR-16 |
| S-57 | Profile editor: unsaved changes, loading, offline and errors | P1 | 5 | FR-19 |
| S-58 | Security section and changing my password | P1 | 5 | FR-18, FR-03 |
| S-59 | Forgot password: admin resets it, player sets a new one | P1 | 5 | FR-03, FR-18, FR-54, FR-55 |
| S-60 | Switch between Vietnamese and English | P1 | 5 | FR-69 |
| S-61 | Tournament quota: 3 per account, admin-approved requests for more | P1 | 5 | FR-70, FR-21, FR-54, FR-55 |
| S-62 | Admin area and platform admin roles | P1 | 5 | FR-09, FR-54, FR-55 |
| S-63 | Admin suspends and reactivates accounts | P1 | 5 | FR-07, FR-54, FR-55 |
| S-64 | Admin sets the default realistic swim limits and their sanity bounds | P1 | 5 | FR-85, FR-54, FR-55 |
| S-93 | Tournament settings: realistic swim limits | P1 | 5 | FR-78, FR-68, FR-74, FR-22, FR-85 |
| S-65 | Organizer console overview | P1 | 5 | FR-29, FR-84 |
| S-66 | In-app notifications | P1 | 5 | FR-53, FR-42, FR-84 |
| S-67 | Push notifications on my device | P1 | 5 | FR-53, FR-17 |
| S-68 | Notification preferences per category | P1 | 5 | FR-17, FR-53 |
| S-69 | Tournament switcher and desktop layout | P1 | 5 | FR-60, FR-30 |
| S-70 | Welcome page for visitors | P1 | 5 | FR-63, FR-58 |
| S-71 | Safety messages and reporting a problem | P1 | 5 | FR-58 |
| S-72 | Admin handles reports and exceptional corrections | P1 | 5 | FR-54, FR-39, FR-55, FR-47 |
| S-73 | App states and installing SwimQuest as an app | P1 | 5 | FR-59 |
| S-74 | Art: brand marks, app icon, banner template, team emblems and default avatars | P1 | 5 | FR-61 |
| S-75 | Art: swimmer avatars and swim motions | P1 | 5 | FR-61 |
| S-76 | Art: badges, collectibles, marine life and effects | P1 | 5 | FR-61, FR-82 |
| S-77 | Asset replacement list for the stakeholder | P1 | 5 | FR-77, FR-62 |
| S-78 | Audit log view for platform admins | P2 | 5 | FR-55 |
| S-79 | Organizer exports the tournament roster and results | P2 | 5 | FR-29 |
| S-80 | Organizer metrics and fairness view | P2 | 5 | FR-57 |
| S-81 | Product funnel events and platform metrics | P2 | 5 | FR-56 |
| S-82 | Share the team's finish | P2 | 5 | FR-42, FR-16 |
| S-83 | Team collectibles: map fragments and treasure chests | P2 | 5 | FR-82 |
| S-84 | Personal collectibles: pearls, starfish, coins and the energy orb | P2 | 5 | FR-82 |
| S-85 | Zalo: connect the organizer's bot and group | P2 | 5 | FR-83 |
| S-86 | Zalo: team, join, move and season start messages | P2 | 5 | FR-83 |
| S-87 | Zalo: counted swim messages | P2 | 5 | FR-83 |
| S-88 | Zalo: milestone and season end messages | P2 | 5 | FR-83 |
| S-89 | Zalo: message switches, delivery problems and player notice | P2 | 5 | FR-83, FR-16 |
| S-90 | Connect section with "coming soon" sources | P2 | 5 | FR-67 |
| S-91 | "Coming soon" sign-in buttons | P2 | 5 | FR-04, FR-64 |
| S-92 | Asset manifest, contact sheet and QA gallery | P2 | 5 | FR-62 |

## FR → Story traceability
In-scope release 1 FRs only. Not listed (no stories): FR-02, FR-20, FR-33 (dropped); FR-05,
FR-06, FR-66 (later release); FR-10 (deferred, Q-18). FR-04, FR-64 and FR-67 are covered for
their release 1 part ("coming soon"); FR-78 item 4 is later release.

| FR | Stories |
|---|---|
| FR-01 | S-01 |
| FR-03 | S-02, S-58, S-59 |
| FR-04 | S-91 |
| FR-07 | S-01, S-02, S-63 (deletion states come with deferred FR-10) |
| FR-08 | S-02 |
| FR-09 | S-03, S-04, S-08, S-45, S-62 |
| FR-11 | S-53 |
| FR-12 | S-53 |
| FR-13 | S-54 |
| FR-14 | S-55 |
| FR-15 | S-16 |
| FR-16 | S-56, S-82, S-89 |
| FR-17 | S-67, S-68 |
| FR-18 | S-58, S-59 |
| FR-19 | S-57 |
| FR-21 | S-04, S-29, S-61 |
| FR-22 | S-06, S-93 |
| FR-23 | S-06, S-10, S-33 |
| FR-24 | S-23, S-32 |
| FR-25 | S-30 |
| FR-26 | S-07 |
| FR-27 | S-28, S-31 |
| FR-28 | S-07, S-31, S-38 |
| FR-29 | S-33, S-65, S-79, S-94 |
| FR-30 | S-13, S-16, S-27, S-43, S-69 |
| FR-31 | S-05 |
| FR-32 | S-35 |
| FR-34 | S-38, S-39, S-41 |
| FR-35 | S-40, S-41, S-42 |
| FR-36 | S-07, S-17, S-38 |
| FR-37 | S-04, S-09, S-14 |
| FR-38 | S-09, S-37, S-94 |
| FR-39 | S-10, S-24, S-72, S-94 |
| FR-40 | S-04, S-09, S-10, S-32 |
| FR-41 | S-14, S-19, S-25, S-39, S-46 |
| FR-42 | S-19, S-47, S-49, S-66, S-82 |
| FR-43 | S-14, S-18 |
| FR-44 | S-11 |
| FR-45 | S-12, S-13, S-16, S-43, S-46 |
| FR-46 | S-12 |
| FR-47 | S-46, S-47, S-72 |
| FR-48 | S-16, S-27, S-43, S-44 |
| FR-49 | S-13, S-20, S-21, S-22, S-25 |
| FR-50 | S-15, S-22 |
| FR-51 | S-48, S-49, S-50, S-51, S-55 |
| FR-52 | S-17 |
| FR-53 | S-66, S-67, S-68 |
| FR-54 | S-59, S-61, S-62, S-63, S-64, S-72 |
| FR-55 | S-08, S-32, S-33, S-36, S-37, S-39, S-40, S-41, S-42, S-43, S-45, S-46, S-50, S-59, S-61, S-62, S-63, S-64, S-72, S-78, S-94 |
| FR-56 | S-81 |
| FR-57 | S-80 |
| FR-58 | S-44, S-70, S-71 |
| FR-59 | S-03, S-73 (screens are delivered across all stories; S-73 adds the shared states) |
| FR-60 | S-03, S-69 |
| FR-61 | S-18, S-74, S-75, S-76 |
| FR-62 | S-77, S-92 |
| FR-63 | S-70 |
| FR-64 | S-91 |
| FR-65 | S-11 |
| FR-67 | S-11, S-90 |
| FR-68 | S-12, S-27, S-93 |
| FR-69 | S-01, S-60 (and every story, cross-cutting) |
| FR-70 | S-61 |
| FR-71 | S-43, S-45 |
| FR-72 | S-26, S-27, S-44 |
| FR-73 | S-04 |
| FR-74 | S-23, S-24, S-26, S-28, S-29, S-93 |
| FR-75 | S-39, S-42 |
| FR-76 | S-08 |
| FR-77 | S-77 |
| FR-78 | S-13, S-23, S-24, S-25, S-28, S-29, S-93 (item 9: S-93; item 4 later release) |
| FR-80 | S-06, S-07, S-34, S-35 |
| FR-81 | S-36 |
| FR-82 | S-18, S-51, S-52, S-76, S-83, S-84 |
| FR-83 | S-85, S-86, S-87, S-88, S-89 |
| FR-84 | S-94, S-24, S-37, S-65, S-66 (push via S-67, same events as in-app) |
| FR-85 | S-64, S-93 |

NFRs are cross-cutting; the ones with a visible slice are referenced in the stories: NFR-01
(S-69, S-73), NFR-05 (S-11, S-56, S-79), NFR-06 (S-79, S-81), NFR-07 (S-54, S-71), NFR-09
(S-78), NFR-10 (S-73), NFR-11/NFR-12 (S-74, S-92), NFR-15 (S-92), NFR-17 (S-81), NFR-19 (S-85),
NFR-20 season start/end date-times (S-04, S-10, S-12, S-24, S-33).
NFR-14 (backup, rollback, incident runbook) and NFR-18 (staging) are delivery concerns for the
Team Lead and DevOps, not user stories.

## Size self-check
Limit `limits.story_max_ac` = 5 (`.squad/config.yml`).

| Story | ACs | ≤ limit? | Split pattern used |
|---|---|---|---|
| S-01 | 5 | yes | by workflow (sign-up separate from login) |
| S-02 | 5 | yes | by workflow; reset split to S-59 |
| S-03 | 5 | yes | simple version first (switcher in S-69) |
| S-04 | 5 | yes | simple version first (optional fields S-29, settings S-23 to S-26, S-93) |
| S-05 | 5 | yes | by CRUD operation |
| S-06 | 5 | yes | happy path first (link control in S-34) |
| S-07 | 5 | yes | by channel (link; public list in S-31, captain link in S-35) |
| S-08 | 5 | yes | by role (handover in S-40) |
| S-09 | 5 | yes | by role (organizer override in S-37) |
| S-10 | 5 | yes | by business rule (lock) |
| S-94 | 5 | yes | by business rule (automatic start, split from S-10) |
| S-11 | 5 | yes | by data type (upload only; sources list in S-90) |
| S-12 | 5 | yes | by business rule (standard checks; extra rules S-27) |
| S-13 | 5 | yes | by business rule (bonuses S-20, multiplier S-21) |
| S-14 | 5 | yes | simple version first (tiers S-52, finish S-19) |
| S-15 | 5 | yes | by data type (one tab; others S-22) |
| S-16 | 5 | yes | happy path first (disputes S-44) |
| S-17 | 5 | yes | simple version first (captain tools later) |
| S-18 | 5 | yes | by data type (art set) |
| S-19 | 5 | yes | happy path first (withdrawal S-47, share S-82) |
| S-20 | 5 | yes | by business rule |
| S-21 | 5 | yes | by business rule |
| S-22 | 5 | yes | by data type (tabs) |
| S-23 | 5 | yes | by business rule (setting group) |
| S-24 | 5 | yes | by business rule (setting group) |
| S-25 | 5 | yes | by business rule (setting group) |
| S-26 | 5 | yes | by CRUD (set rules) |
| S-27 | 5 | yes | by business rule (apply rules) |
| S-28 | 5 | yes | by CRUD (read) |
| S-29 | 5 | yes | simple version first follow-up |
| S-30 | 5 | yes | by business rule |
| S-31 | 5 | yes | by channel (public list) |
| S-32 | 5 | yes | by CRUD (update) |
| S-33 | 5 | yes | by workflow (end of lifecycle) |
| S-34 | 5 | yes | by CRUD (link control) |
| S-35 | 5 | yes | by role/channel |
| S-36 | 5 | yes | by role |
| S-37 | 5 | yes | by role |
| S-38 | 5 | yes | by business rule (before/after start) |
| S-39 | 5 | yes | by role (organizer) |
| S-40 | 5 | yes | by role (captain) |
| S-41 | 5 | yes | by business rule (removal) |
| S-42 | 5 | yes | by business rule (re-adding) |
| S-43 | 5 | yes | happy path first (disputes S-44, helpers S-45) |
| S-44 | 5 | yes | by workflow (dispute) |
| S-45 | 5 | yes | by role |
| S-46 | 5 | yes | by workflow (correction) |
| S-47 | 5 | yes | by business rule (BR-32) |
| S-48 | 5 | yes | by business rule (personal badges) |
| S-49 | 5 | yes | by business rule (team badges) |
| S-50 | 5 | yes | by business rule (season, special) |
| S-51 | 5 | yes | by business rule |
| S-52 | 5 | yes | by business rule |
| S-53 | 5 | yes | by CRUD (profile basics) |
| S-54 | 5 | yes | by data type (profile section) |
| S-55 | 5 | yes | by data type (profile section) |
| S-56 | 5 | yes | by business rule (privacy) |
| S-57 | 5 | yes | edge cases later |
| S-58 | 5 | yes | by workflow |
| S-59 | 5 | yes | by role (admin reset) |
| S-60 | 5 | yes | by business rule |
| S-61 | 5 | yes | by business rule (quota) |
| S-62 | 5 | yes | by role |
| S-63 | 5 | yes | by role |
| S-64 | 5 | yes | by role (admin: defaults and bounds) |
| S-93 | 5 | yes | by role (organizer: tournament limits, split from S-64) |
| S-65 | 5 | yes | simple version first (export S-79, metrics S-80) |
| S-66 | 5 | yes | by channel (in-app) |
| S-67 | 5 | yes | by channel (push) |
| S-68 | 5 | yes | by business rule (preferences) |
| S-69 | 5 | yes | by data type (several tournaments) |
| S-70 | 5 | yes | by role (visitor) |
| S-71 | 5 | yes | by workflow |
| S-72 | 5 | yes | by role |
| S-73 | 5 | yes | edge cases later |
| S-74 | 5 | yes | by data type (art set) |
| S-75 | 5 | yes | by data type (art set) |
| S-76 | 5 | yes | by data type (art set) |
| S-77 | 5 | yes | by data type (deliverable) |
| S-78 | 5 | yes | by role |
| S-79 | 5 | yes | by workflow |
| S-80 | 5 | yes | by data type |
| S-81 | 5 | yes | by data type |
| S-82 | 5 | yes | by channel (share) |
| S-83 | 5 | yes | by business rule (team) |
| S-84 | 5 | yes | by business rule (personal) |
| S-85 | 5 | yes | by workflow (setup) |
| S-86 | 5 | yes | by data type (message kinds) |
| S-87 | 5 | yes | by data type (message kinds) |
| S-88 | 5 | yes | by data type (message kinds) |
| S-89 | 5 | yes | edge cases later |
| S-90 | 5 | yes | by channel |
| S-91 | 5 | yes | by channel |
| S-92 | 5 | yes | by data type (deliverable) |

## GATE 2 decisions applied (round 1, 2026-10-15)
Stakeholder answer recorded verbatim in `sources/stakeholder-notes.md`. Applied without a
requirement change:
- Tie order below 100%: the team that reached that progress first ranks higher (S-15 AC 3; same
  rule as FR-50 "ties broken by who reached it first").
- Accepted: swim type handled like a missed extra rule (S-23); multiplier streak reading (S-21).
- Confirmed: visibility changeable after publishing (S-30); a captain who leaves or is moved
  leaves the team without a captain until the organizer appoints one (S-38, S-39).
- Kept: reviewers see a flagged swim's track (S-43), ship-tier upgrade effect (S-52), reduced
  motion for swimmers (S-75), last admin cannot remove their own role (S-62).

## GATE 2 decisions applied (round 2, after the GATE 1 re-sign, 2026-10-15)
The stakeholder's GATE 2 answers 1, 2 and 4 changed signed-off requirements. They were
clarified as Q-56, Q-57 and Q-58 (with assumptions A-28, A-29) and re-signed on 2026-10-15
("xác nhận"). Applied to the stories:
1. **Organizer-set realistic swim limits (Q-56, FR-78 item 9, FR-85, FR-68, FR-72, BR-25,
   BR-38, A-29).** Each tournament has its own fastest pace, slowest pace and longest
   realistic swim, pre-filled with platform defaults (1:05 and 5:00 per 100 m, 30 km) and kept
   inside admin-set sanity bounds; locked at season start; a swim outside them is flagged for
   that tournament's review, while a missed extra rule still does not count (dispute only).
   - S-12 rewritten: checks use the tournament's limits; new AC 5 "limits are per tournament".
   - New S-93 (P1): the organizer sets the tournament's realistic swim limits.
   - S-64 rewritten: the admin sets the defaults and sanity bounds (FR-85), changes affect only
     tournaments created afterwards (A-29).
   - S-26 AC 2: extra slowest pace must be faster than the tournament's realistic slowest pace.
   - S-27 AC 5: extra-rule miss ("rule missed") vs realistic-limit miss (flagged) shown apart.
   - Touched: S-06 (publish checks limits inside bounds), S-28 (limits shown), S-32 (limits
     locked when active), S-23 and S-43 (notes).
2. **Automatic start at the start-choice deadline (Q-57, FR-84, FR-38, FR-39, FR-29, FR-53,
   FR-55, BR-02, A-28).** The least-chosen start, ties at random, teams one at a time in random
   order; audited as a system action; members notified in-app and by push; organizer sees
   "assigned automatically"; locked like a chosen start.
   - New S-94 (P0, right after S-10): the assignment, ties, lock, label and audit.
   - S-10 AC 2 and AC 5 cover automatically assigned starts; S-37 AC 1, AC 2, AC 5; S-65 AC 4;
     S-66 AC 3 (notification; push through S-67); S-09 AC 1 (deadline and notice shown);
     S-24 AC 4 (assignment at an earlier deadline).
3. **Season start and end as date and time (Q-58, FR-21, FR-22, FR-23, FR-39, FR-68, FR-78
   items 5 and 6, NFR-20, BR-16, BR-33).** Entered in Vietnam time, pre-filled 00:00 and 23:59;
   end after start; a swim is inside the season by its start time; the start-choice deadline
   defaults to the season start time; the after-season upload days count from the season end
   time; A-26 and Monday-to-Sunday weeks unchanged.
   - S-04 AC 1, new AC 3 (pre-filled times) and AC 4 (date-time validation); the two route ACs
     merged into AC 2 to stay at 5.
   - S-10 AC 1 (active at the start time); S-12 AC 3 (start time vs season range); S-24 AC 1,
     AC 3, AC 4; S-33 AC 1, AC 2; S-06, S-28, S-32, S-65 (date-times shown or validated).
- Not edited: S-72. Per FR-39 its exceptional correction of a locked start applies to
  automatically assigned starts too; S-94 AC 3 and S-37 AC 5 point to it.
