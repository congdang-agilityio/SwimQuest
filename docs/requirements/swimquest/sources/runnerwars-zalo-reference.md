# Source stub: RunnerWars Zalo group bot and notifications (reference only)

- ID: SRC-16
- Origin: the stakeholder's other game RunnerWars, local repository `/home/congdang/Projects/games/RunnerWars`
  (not part of SwimQuest). The stakeholder invited the BA to look at it for the Zalo bot feature (Q-17).
- Retrieved: 2026-10-15, read by the BA (README.md, PLAN.md, docs/game-rules.md, docs/integrations.md).
- Status: **reference only**. It describes how RunnerWars behaves. Nothing here is a SwimQuest
  requirement until the stakeholder confirms it (Q-54, Q-55). No code, keys, tokens or
  environment values were copied; technology is not chosen here.

## Content

### Zalo group bot (RunnerWars "events", runner-organised competitions)
Source: `PLAN.md` §22.5 "Events", bullet "Zalo group bot" (lines 1283-1303).

- **Optional, per event, set up by the event's organisers.** An organiser enters their own Zalo
  bot's key on the event (when creating the event or later). The app checks the key is valid.
- **How a group gets linked:** the organiser adds the bot to their Zalo group; the first group the
  bot hears from (for example when someone mentions the bot or replies to it in the group) becomes
  the event's group. RunnerWars also shows the organiser the details needed to set this up by hand.
- **One bot, several events:** saving the same bot on a new event reuses the group it already posts
  to; removing it from one event does not break the others.
- **The bot only posts, it never replies.** Listening to the group is used only to learn which group
  to post to.
- **Messages are in Vietnamese** (formatted text). The bot posts:
  1. the event introduction (dates, rules, join link), when the group connects;
  2. each new team, with a link that opens the event with that team preselected;
  3. each player who joins, with their team, the team's size and a link to join the same team;
  4. a player switching teams (or being moved by the organisers), with both team sizes and a link
     to the new team;
  5. the start of the event, repeating the rules;
  6. every counted run: who, distance, time, pace, what it achieved in the game, and the player's
     rank; a run that counts in several events posting to the same group is sent as one message
     with a block per event;
  7. the end (podium for players and teams, totals), and a cancellation.
- **Organiser controls:** on the event's Zalo card the organiser switches each message kind on or
  off (start, results, new teams, players joining or switching, every run; all on by default) to
  keep a busy group quiet. The introduction and a "Post event again" action always go out.
- **Failures:** delivery errors are shown to the organisers and never affect the game. The bot key
  is stored protected.
- Rank-ups are mentioned only inside the run message of an active event (`PLAN.md` §22.13
  "Decisions", line 1415-1417; `docs/game-rules.md` "Ranks", lines 17-20).
- Covered by automated tests against a fake Zalo service (`PLAN.md` §22.14, lines 1423-1429).

### Related product observations
- **Zalo's in-app browser:** RunnerWars' player guide explains how to leave Zalo's built-in browser
  to install the PWA (`PLAN.md` §22.9, line 1350). Links shared in a Zalo group open there first.
- **Team switching rule in RunnerWars events:** "organisers can move a runner to another team until
  the event ends; the sectors they hold move with them. Runners themselves can only switch before
  the start" (`PLAN.md` §22.5 "Balancing teams", lines 1274-1275; `docs/game-rules.md` "Events",
  lines 103-105). Relevant to SwimQuest Q-50/Q-53 only as an example, not as a decision.

### Other notification channels in RunnerWars (for comparison)
Source: `PLAN.md` §22.8 (lines 1336-1346); `docs/game-rules.md` "Notifications" (lines 117-121).
- In-app: a notification bell keeping the latest 100 notifications, with an unread badge; a toast
  while the app is on screen.
- Web Push for the installed PWA: each category can be switched off; no push while the app is on
  screen; subscriptions survive sign-out; written in the player's chosen language.
- On iPhone, push needs iOS 16.4 or later and the app added to the Home Screen.
- RunnerWars has no email notifications.
