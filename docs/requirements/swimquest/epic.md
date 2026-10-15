# SwimQuest release 1: team swimming expedition platform (Route 01)

## Summary
SwimQuest is a mobile-first web app (PWA) in which players join tournaments, are placed in
organizer-created teams, upload verified swims as GPX/FIT files and earn points that move their
team's ship along Route 01 from a chosen beach to the shared finish at Lý Sơn. Release 1 holds
everything in the design pack with the stakeholder's limits (email sign-up without
verification, GPX/FIT upload only, "coming soon" for external sign-in and sources, Vietnamese
and English, Vietnam time, metric units) and is deployed to staging for a closed pilot of under
100 players. Requirements signed off 2026-10-15 and re-signed the same day for the change
raised at GATE 2: each tournament's organizer sets its realistic swim limits inside admin-set
bounds (Q-56), a team with no start at the deadline gets the least-chosen start automatically
(Q-57), and the season start and end are a date and time in Vietnam time (Q-58). Details in
`prd.md` and `requirements.md`.

Out of release 1: data export/deletion, retention, analytics consent and minors policy
(deferred, Q-18, Q-28); working Strava/Google/Facebook sign-in, Strava/Garmin/Coros/Suunto
import and manual swim entry (later release, Q-33, Q-34, Q-38).

## Stories
Priorities express delivery order (A-10): P0 = thin playable core on staging first. S-93 and
S-94 were added by the post-GATE-2 change and are listed at their delivery position.

### P0: playable core
- S-01 Sign up with email, password and display name
- S-02 Log in and log out
- S-03 App navigation and home page
- S-04 Create a tournament draft
- S-05 Organizer creates teams with member limits
- S-06 Publish a tournament and get its invite link
- S-07 Join a tournament through its invite link by choosing a team
- S-08 Organizer appoints and changes a team captain
- S-09 Captain chooses the team's Route 01 start
- S-10 Season start: tournament becomes active and the start choice locks
- S-94 A team with no start at the deadline gets one automatically
- S-11 Upload a GPX or FIT swim file
- S-12 Automatic checks verify or flag an uploaded swim
- S-13 Verified swims earn distance points for the player and the team
- S-14 The team's ship moves along the Route 01 map
- S-15 Team leaderboard: Progress tab
- S-16 My swims: history with status per tournament
- S-17 My Team page with roster and contributions
- S-18 Art: Route 01 map, landmarks and ships

### P1: full game, organizer tools, profile, admin
- S-19 Reach Lý Sơn: finish and "HOÀN THÀNH" experience
- S-20 First-swim and long-swim bonuses
- S-21 Weekly consistency multiplier
- S-22 Leaderboard: Points, Total km and Badges tabs
- S-23 Tournament settings: longest swim, daily limit and swim type
- S-24 Tournament settings: submission deadline and start-choice deadline
- S-25 Tournament settings: point values
- S-26 Set extra swim rules for a tournament
- S-27 Swims that miss an extra rule do not count in that tournament
- S-28 Tournament details and rules page
- S-29 Optional tournament fields and written rules
- S-30 Choose "Public" or "Invite link only"
- S-31 Find public tournaments with search and filter
- S-32 Edit a tournament within its lifecycle rules
- S-33 Season end, completion and archive
- S-34 Switch off or replace the invite link
- S-35 Captain invites players with the team preselected
- S-36 Captain edits team details; organizer can override
- S-37 Organizer chooses or overrides a team's start before the lock
- S-38 Player leaves or switches team before the start; blocked after
- S-39 Organizer moves a player to another team
- S-40 Captain hands over captaincy
- S-41 Remove a team member before or after the start
- S-42 Organizer adds a player to a team
- S-43 Review queue: decide flagged swims
- S-44 Dispute a swim's result
- S-45 Organizer appoints review helpers
- S-46 Revoke a verified swim
- S-47 Finish withdrawn when a team drops below 100%
- S-48 Badges: Participation, Conqueror and Perseverance
- S-49 Badges: Explorer, Teamwork and Lý Sơn
- S-50 Badges: Season and Special
- S-51 XP and levels
- S-52 Ship tiers follow team progress
- S-53 My Profile page: view and edit basic info
- S-54 Swimming profile: goals and preferred disciplines
- S-55 Verified stats and badges on the profile
- S-56 Privacy settings and public profile
- S-57 Profile editor: unsaved changes, loading, offline and errors
- S-58 Security section and changing my password
- S-59 Forgot password: admin resets it, player sets a new one
- S-60 Switch between Vietnamese and English
- S-61 Tournament quota: 3 per account, admin-approved requests for more
- S-62 Admin area and platform admin roles
- S-63 Admin suspends and reactivates accounts
- S-64 Admin sets the default realistic swim limits and their sanity bounds
- S-93 Tournament settings: realistic swim limits
- S-65 Organizer console overview
- S-66 In-app notifications
- S-67 Push notifications on my device
- S-68 Notification preferences per category
- S-69 Tournament switcher and desktop layout
- S-70 Welcome page for visitors
- S-71 Safety messages and reporting a problem
- S-72 Admin handles reports and exceptional corrections
- S-73 App states and installing SwimQuest as an app
- S-74 Art: brand marks, app icon, banner template, team emblems and default avatars
- S-75 Art: swimmer avatars and swim motions
- S-76 Art: badges, collectibles, marine life and effects
- S-77 Asset replacement list for the stakeholder

### P2: secondary features
- S-78 Audit log view for platform admins
- S-79 Organizer exports the tournament roster and results
- S-80 Organizer metrics and fairness view
- S-81 Product funnel events and platform metrics
- S-82 Share the team's finish
- S-83 Team collectibles: map fragments and treasure chests
- S-84 Personal collectibles: pearls, starfish, coins and the energy orb
- S-85 Zalo: connect the organizer's bot and group
- S-86 Zalo: team, join, move and season start messages
- S-87 Zalo: counted swim messages
- S-88 Zalo: milestone and season end messages
- S-89 Zalo: message switches, delivery problems and player notice
- S-90 Connect section with "coming soon" sources
- S-91 "Coming soon" sign-in buttons
- S-92 Asset manifest, contact sheet and QA gallery
