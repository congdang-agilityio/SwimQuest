# How I understand SwimQuest (for sign-off, after 56 answers, including the change after GATE 2)

## In one paragraph
SwimQuest is a team swimming game in one web app (PWA) for phones and computers. Any player can
create a tournament (up to 3 per account; more with an admin's approval) and becomes its
organizer. The organizer picks the route (only Route 01 for now), enters the route distance in
km, sets one date range for the season, chooses the tournament's settings and rules, creates
the teams with their size limits, and makes the tournament "Public" (listed) or "Invite link
only". Players open the invite link (or find a public tournament) and pick a team with room;
they are in at once. Each team's captain picks one of six beaches as the start; every start has
the same distance to Lý Sơn island. In release 1 players record swims **only by uploading a GPX
or FIT file**. Every verified swim earns points (per km, plus bonuses and a weekly bonus for
swimming regularly), and the team's points move its ship across the ocean map to Lý Sơn.
Players are notified in the app and by phone push; an organizer can also have their own Zalo
bot post to the tournament's Zalo group. The first audience is a closed pilot of under 100
players on the staging site.

## Release 1 scope
- **Everything in the design pack**, put on the **staging** (test) site, for a **closed pilot of
  under 100 players**, no fixed date.
- **Accounts:** sign up with email, password and a display name; **no email verification**.
  Strava, Google and Facebook sign-in appear only as **"coming soon" buttons**. No public @handle.
- **Forgot password:** no reset email; a **platform admin resets the password** on request.
- **One web app for everyone.** Organizers and admins see extra functions for their role.
- **Menu (phone):** Home, Tournaments, My Team, Voyage, Profile.
- **Languages:** Vietnamese and English, switchable; **Vietnamese by default**. What organizers
  type (names, descriptions, rules) is shown as typed. Zalo messages are Vietnamese only.
- **Time and units:** **Vietnam time (UTC+7)** for every date, deadline, day and week;
  **meters and kilometers** only.
- **Art:** cut-outs from the concept image, simple flat drawings for what is missing, and a list
  of every asset you should replace.

## Key rules
- **Tournaments:** any player, at most **3 over the account's lifetime** (more with admin
  approval); one date range; joining open from publishing until the season ends; "Public" or
  "Invite link only". No eligibility rules, only free-text "eligibility notes".
- **Tournament settings (with defaults):** longest swim counted (10 km), one daily limit
  (10 km), swim type (pool and open water), submission deadline (7 days, and 3 days after the
  season end time), start-choice deadline (season start time), point values (platform values or
  changed, locked at the season start), written rules text, realistic swim limits (fastest pace
  1:05 and slowest pace 5:00 per 100 m, longest swim 30 km), plus extra swim rules (minimum
  distance per swim, slowest pace allowed).
- **Season dates:** the season start and end are a date and a time (Vietnam time), pre-filled
  00:00 and 23:59.
- **Teams:** only the **organizer creates teams** and appoints captains. Picking a team with
  room joins it at once, no approval. A captain invites by sharing the link with their team
  already selected, chooses the start, edits team details, removes members and hands over
  captaincy; the organizer can override. A team with no start at the deadline gets one
  automatically.
- **Team changes:** before the season starts, players may leave or switch teams. **After the
  start, players cannot leave or switch on their own.** The organizer can still move a player
  (their swims and points go with them), and the captain or organizer can still remove a member:
  the removed player leaves the tournament and their swims stay with the team.
- **Teammates** always see each member's contribution; privacy settings apply to everyone else.
- **Recording swims:** GPX/FIT upload only. Typing a swim in by hand comes in a later release.
  Strava, Garmin, Coros and Suunto are listed in "Connect" as "coming soon".
- **Checking swims:** uploaded swims pass automatic checks (is a swim, inside the season, not a
  duplicate, pace and distance within the tournament's realistic limits). A swim that misses a tournament's extra rule does not
  count there (the player can dispute). Swims that fail a check, and disputes, go to the
  **organizer or their helpers**; each tournament decides for itself. Pool and open-water swims
  count the same; one swim counts in every tournament the player is in.
- **Scoring:** 10 points per km; +20 for the first swim; +10 for a swim of 1 km or more (+25 for
  3 km or more), once a day; a weekly bonus of +10% / +20% for 2 / 3+ active days, growing with
  a streak up to +40%; team points = members' points. Organizers may change these numbers before
  the season starts; XP always uses the platform's numbers.
- **The ship:** route length in points = route km × 10. Plain swimming moves the ship at real
  speed; bonuses make it faster. Shown as % and route km ("68 / 100 route km · 68%"). The ship
  stops at Lý Sơn; points and XP keep counting. Ship tier 2 at 35%, tier 3 at 70%.
- **Losing the finish:** if a finished team drops below 100%, the finish and the Lý Sơn badge are
  removed until it gets back to 100%.
- **Leaderboard tabs:** Progress, Points, Total km and Badges.
- **Badges:** Participation, Explorer, Perseverance, Teamwork, Conqueror, Season, Special (given
  by the organizer) and Lý Sơn, with the rules you accepted. **Share achievement** makes a
  picture and a link to send through the phone's share menu.
- **Levels and collectibles:** levels need 25 × n × (n − 1) XP; map fragments, chests, pearls,
  starfish and coins are for collecting only.
- **Notifications:** in the app and as phone push; **no emails**. Optional **Zalo bot**: each
  organizer creates their own bot, enters its key in the tournament settings and adds it to
  their group; the group is linked when the bot is first mentioned there. It posts, in
  Vietnamese: the introduction, new teams, players joining, players moved, season start, every
  counted swim, milestones (passing a beach, reaching Lý Sơn, losing the finish) and the season
  end with the final leaderboard. The organizer can switch each kind off except the introduction.
- **Building:** no separate repository assessment; your approval of these requirements and then
  of the stories is the go-ahead to build.

## Not in release 1
- **Later releases:** working Strava, Google and Facebook sign-in; importing swims from Strava,
  Garmin, Coros and Suunto; typing swims in by hand (with review).
- **Postponed until before a public launch (you agreed):** personal data export and deletion,
  how long data is kept and analytics consent (Q-18); the minimum age and minors (Q-28). The
  pilot is closed, so they stay postponed.
- **Not planned:** App Store / Google Play apps, Apple sign-in, email verification, emails of
  any kind, join requests and approvals, public @handles, yards and miles, eligibility rules,
  translating organizers' texts, real-world navigation, showing exact GPS positions.

## Things you should know
- **Every pilot player needs a watch or app that exports GPX/FIT.** Some pool swims exported as
  GPX have no distance in them.
- **Zalo groups may include people outside the tournament.** They will see players' names and
  swims there, whatever the players' privacy settings. The organizer can switch those messages
  off. Links opened from Zalo open in Zalo's own browser, where installing the app and push may
  not work; players may need a short guide.
- **Push on iPhone** works only on iOS 16.4 or later, after adding the app to the Home Screen.
- **Organizer moves after the start** carry a player's points to another team and can push it
  over the finish (or pull the old team below it). Every move is recorded.
- With the default values, a team that swims three times a week moves about 70% faster than the
  km it swims; organizers should keep this in mind when they set the distance.
- Without email verification, someone can sign up with another person's email or create extra
  accounts to get past the 3-tournament limit. The admin should check who is asking before
  resetting a password. A GPX/FIT file can be edited before upload.
- Release 1 is very large. I will order the stories so a simple playable version reaches staging
  first; this changes the order, not what is included.

## What I am assuming (please check)
1. The closed pilot plays on the staging site; going live for the public is a later decision (A-09).
2. One tournament runs one season (one date range) (A-03).
3. Where the concept image and the written specs disagree, the written specs win, except where
   you decided otherwise (A-05).
4. The first platform admin is set up by the operator; an admin can make other users admins in
   the app (A-07).
5. 3-tournament limit: every tournament a player creates counts, even a deleted draft; each
   approved request allows one more (A-11).
6. Organizer extra rules are a minimum distance per swim (meters) and the slowest pace allowed (A-12).
7. Swimmer art includes four strokes: freestyle, breaststroke, backstroke and butterfly (A-14).
8. No solo play outside teams; a one-person team is a team with a limit of 1 (A-15).
9. Invite link: a full team cannot be chosen; a tournament needs at least one team before it is
   published; the organizer can turn the link off or replace it (A-17).
10. Lost finish: the team is told; when it reaches 100% again, the new time counts for ties (A-18).
11. Manual entry is not shown at all in release 1, not even as "coming soon" (A-20).
12. "Total km" counts the km that count in the tournament (after its limits), without bonuses;
    "Badges" counts the badges the team's members earned in this tournament (A-21).
13. A link shared by a captain opens with their team selected, but the player can still pick
    another team with room (A-22).
14. A member removed after the start cannot rejoin through the link; only the organizer can add
    them back to a team with room. Swims they upload after the removal do not count there (A-23).
15. When a tournament has a Zalo group, the tournament page and join screen tell players that
    their name and swims are posted there (A-24).
16. Forgot password: the login screen tells the player how to contact the admin; the admin sets
    a temporary password (recorded), and the player must choose a new one at the next login (A-25).
17. A swim belongs to the day (Vietnam time) on which it started (A-26).
18. The display name entered at sign-up can be changed later in My Profile and does not have to
    be unique (A-27).
19. The build order puts a playable core on staging first; nothing is cut (A-10).
20. New with the change: when several teams have no start at the deadline, they are given
    starts one at a time in random order, so the missing starts spread out (A-28).
21. New with the change: the admin enters the outer bounds for the realistic limits; changing the
    platform defaults or bounds affects only tournaments created afterwards (A-29).

## Change after GATE 2 (needs your confirmation again)
At story review you changed three points. Here is exactly what changes in the signed-off
requirements; everything else stays as you signed it.

1. **Realistic pace and distance limits (Q-56).** Before: a platform admin set one set of limits
   for all tournaments. Now: each tournament has its own limits, set by its organizer: fastest
   pace (starts at 1:05 per 100 m), slowest pace (starts at 5:00 per 100 m) and longest realistic
   swim (starts at 30 km; this is separate from "longest swim counted", 10 km). The starting
   values come from platform defaults; the organizer can change them only inside wide bounds the
   platform admin sets. The limits lock when the season starts. A swim outside them goes to that
   tournament's review queue (the organizer or helpers decide). A swim that misses an extra rule
   still simply does not count and can only be disputed. The same swim can pass in one
   tournament and be flagged in another.
2. **Start assigned automatically (Q-57).** Before: a team without a start at the lock was not
   covered. Now: at the start-choice deadline, a team with no start gets the start the fewest
   teams in the tournament have; ties are decided at random. This is recorded as a system
   action, the team's members get an in-app and push notice, the organizer sees "assigned
   automatically", and the start is then locked like a chosen one (only an admin's recorded
   exceptional correction can change it). These details were listed in the question and you
   chose B without changing them, so I have taken them as agreed; please say if any is wrong.
3. **Season start and end times (Q-58).** Before: the season was a start date and an end date.
   Now: the organizer enters a date and a time for each, in Vietnam time, pre-filled 00:00 on the
   start date and 23:59 on the end date; the end must be after the start. A swim counts in the
   season if it started inside that range. The tournament becomes active at the start time and
   ends at the end time. The start-choice deadline is the season start time unless the
   organizer changes it; "N days after the season ends" for late uploads counts from the end
   time. The daily limit and the one-long-swim-bonus-a-day still use the day the swim started,
   and weeks still run Monday to Sunday.

New assumptions with this change: 20 and 21 above.

All 58 questions are settled: 56 confirmed, 2 postponed (Q-18, Q-28). Details are in
`requirements.md` and `questions.md`.
