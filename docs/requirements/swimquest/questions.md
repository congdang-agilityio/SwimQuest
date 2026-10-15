# Clarifying questions: SwimQuest (full platform + Route 01)

- Slug: `swimquest`
- Open: 0 · Answered: 0 · Confirmed: 56 · Deferred: 2
- Next batch to ask: none. The post-GATE-2 change questions Q-56, Q-57, Q-58 are confirmed; the change is clear for the GATE 1 re-sign (summary in `understanding.md` "Change after GATE 2"; new assumptions A-28, A-29).
- Deferred with the stakeholder's agreement (2026-10-15): Q-18, Q-28, until before a production launch. Q-29 = closed pilot, no public launch, so they stay deferred.

Rules: the PM asks each question **verbatim** (translation allowed, no rephrasing, merging or
answering) and records the answer verbatim plus an English translation. Only the BA changes a
status to `confirmed` or `deferred`.

---

### Q-01: What goes into the first release
- **Question:** The design pack describes a very large platform (accounts, profiles, tournaments, teams, Route 01, activity verification, leaderboards, badges, organizer console, admin tools, analytics, full game art). What should the first release that real players use contain?
- **Why it matters:** It decides how many stories we write and in which order. Building everything before anyone can play delays feedback by months; cutting too much may miss what the pilot needs.
- **Related:** all FRs, R-02, SRC-4 backlog
- **Options:**
  - A) Everything in the design pack before the first release.
  - B) A playable core first: email sign-up/login, a basic profile, organizer creates and publishes a tournament, players join and form teams, the captain picks a start, players submit swims, swims get verified, the team map and leaderboard show progress. Later releases add Strava, full profile settings, badges/XP, collectibles, analytics dashboards, data export/deletion and premium art.
  - C) A different cut (please describe what must be in the first release).
- **Answer (original):** Release 1: Tất cả những gì có trong design nhưng chỉ cần đăng ký account với email (không cần verify) và đăng nhập vào chơi được như design, deploy lên staging
- **Answer (English):** Release 1: Everything in the design, but account registration only needs email (no verification required), and logging in to play as in the design; deploy to staging.
- **Status:** confirmed
- **BA note:** Confirmed. Release 1 = everything in the design pack, deployed to staging (NFR-18). Limits the stakeholder set: email registration without verification (FR-01; FR-02 dropped; FR-07 has no pending-verification state). Scope section rewritten. Follow-ups: password reset without verified emails (Q-39); whether release 1 also goes to production stays with Q-29 (assumption A-09: staging only). The BA will still order stories so a playable core reaches staging first (A-10); that is ordering, not a scope cut.

### Q-02: Web app or mobile apps
- **Question:** Should players use SwimQuest in a web browser on their phone (installable as a home-screen app), or do you also need apps in the Apple App Store / Google Play?
- **Why it matters:** Store apps are a much larger build and release effort; some activity sources (for example Apple Health) are only reachable from a native iPhone app.
- **Related:** NFR-01, A-01, R-08
- **Options:**
  - A) Web only (mobile-first, installable on the home screen), with a desktop-friendly organizer console.
  - B) Web first now, store apps maybe later.
  - C) Store apps are required for the first release.
- **Answer (original):** chỉ làm web (PWA), quản trị cũng trên PWA đó, chỉ là khác role nên có những chức năng khác player bình thường.
- **Answer (English):** Web only (PWA); administration is also in that same PWA, just a different role, so it has functions different from a normal player.
- **Status:** confirmed
- **BA note:** Confirmed. Web only (PWA); organizer and admin functions are in the same PWA, shown by role (NFR-01, FR-09). A-01 confirmed. Consequence noted in R-08: Apple Health cannot be read from a web app; Apple Watch users would upload a GPX/FIT export.

### Q-03: How swims get into SwimQuest
- **Question:** The design pack says to "preserve the existing activity intake", but nothing exists yet, so we must build it. In the first release, how should a player record a swim?
- **Why it matters:** This is the core of the game and shapes the data we store, integrations with outside services (each needs its own approval), and how hard cheating is.
- **Related:** C-01, G-01, FR-44, FR-46, FR-06, R-01, R-08
- **Options:**
  - A) Manual entry only (date, distance, duration, optional note and proof such as a screenshot or photo).
  - B) Upload a file exported from a watch/app (for example GPX or FIT), plus manual entry.
  - C) Import from Strava after the player allows it (plus manual entry as a fallback).
  - D) Several sources as on the concept board: Garmin, Strava, Apple, file upload and manual (please say which ones are needed first).
  - E) Other (please describe).
- **Answer (original):** Nhiều nguồn, add nhiều options trong phần connect, nhưng release 1 ưu tiên upload file gpx, fit. Nhập tay cần được kiểm duyệt
- **Answer (English):** Multiple sources; add many options in the connect section, but release 1 prioritizes uploading GPX and FIT files. Manual entry needs to be moderated/reviewed.
- **Status:** confirmed
- **BA note:** Confirmed. Release 1 intake = GPX/FIT file upload (FR-65, priority) and manual entry with human review (FR-66); a Connect section lists several sources (FR-67). Follow-ups: which external sources actually work in release 1 vs only shown (Q-34); what a manual entry must contain (Q-38). Round 6 update: Q-38 removed manual entry from release 1; it and its review come in a later release.

### Q-04: Who verifies a swim
- **Question:** Only "verified" swims count toward progress. Who or what decides that a submitted swim is verified, and who handles disputes?
- **Why it matters:** It decides whether we need a review queue and reviewer screens, how long players wait for progress, and how trustworthy the leaderboard is.
- **Related:** C-01, G-02, G-18, FR-45, FR-48, R-07
- **Options:**
  - A) A person reviews every swim (the tournament organizer or helpers they appoint); disputes go to the organizer, then a platform admin.
  - B) Automatic checks (for example plausible distance/pace, inside the season dates, not a duplicate) accept most swims; only flagged swims and disputes go to the organizer.
  - C) Swims imported from a trusted source are accepted automatically; manual entries need organizer review.
  - D) Other (please describe, including what makes a swim valid).
- **Answer (original):** b, kiểm tra tự động những nguồn tin cậy từ strava, garmin, corros, sunnto, upload gpx, fit, riêng nhập tay phải qua kiểm duyệt.
- **Answer (English):** B: automatic checks for trusted sources from Strava, Garmin, Coros (written "corros"), Suunto (written "sunnto"), and GPX/FIT uploads; manual entry alone must go through review/moderation.
- **Status:** confirmed
- **BA note:** Confirmed. Option B: automatic checks accept swims from trusted sources (GPX/FIT upload; Strava, Garmin, Coros, Suunto once connected); flagged swims and disputes go to the organizer (FR-45, FR-48, FR-68, BR-18); manual entries always need a person's approval (BR-19). Follow-ups: who reviews manual entries (Q-35); the automatic check rules (Q-36); which swims count, pool and/or open water (Q-37). Risk R-07 notes GPX/FIT files can be edited before upload.

### Q-05: Sign-in methods
- **Question:** Which sign-in methods should the first release offer? The written specs say email/password plus an optional "Continue with Strava"; the concept image shows Google, Apple and email instead.
- **Why it matters:** Each sign-in provider needs its own setup, approval and account-linking rules; it also changes the sign-up screens.
- **Related:** C-02, AMB-05, FR-01, FR-02, FR-04, FR-05
- **Options:**
  - A) Email/password only (with email verification).
  - B) Email/password + Strava (as in the written specs).
  - C) Email/password + Google + Apple (as in the concept image).
  - D) Email/password + Google + Apple + Strava.
  - E) Other (please describe). Please also say whether email verification is mandatory before playing.
- **Answer (original):** Email/mật khẩu, Strava, Google, Facebook, hãy chuẩn bị ready nhưng chưa enable vội, release đầu tiên chỉ cần email, mật khẩu .
- **Answer (English):** Email/password, Strava, Google, Facebook: prepare them to be ready but do not enable them yet; the first release only needs email and password.
- **Status:** confirmed
- **BA note:** Confirmed. Release 1 enables email/password only (FR-01). Strava, Google and Facebook are 'prepared but not enabled' (FR-04, FR-05, new FR-64). Apple sign-in from the concept image is not requested (out of scope). C-02 and AMB-05 resolved. Follow-up: what 'prepared but not enabled' must deliver in release 1 (Q-33).

### Q-06: Fairness between start points
- **Question:** Teams start from different beaches; the concept image shows very different distances to Lý Sơn (Cù Lao Chàm 62 km, Non Nước 178 km), and teams are ranked by percentage of their own route. How should this be fair?
- **Why it matters:** With different lengths and ranking by percentage, a team starting at Cù Lao Chàm reaches 100% almost three times sooner. This decides the scoring rules, the leaderboard and what the start choice means.
- **Related:** AMB-02, FR-40, FR-41, FR-50, BR-07, R-04
- **Options:**
  - A) Different lengths on purpose: choosing a shorter start is a strategic advantage (for example for smaller or newer teams).
  - B) Different lengths, but the organizer sets each start's required swim distance so all starts take comparable effort (the km on the map is only scenery).
  - C) Every start requires the same swim distance; the start only changes the scenery and the path on the map.
  - D) Other (please describe, for example adjusting by team size).
- **Answer (original):** c -  ảnh chỉ là concept. Hãy làm cho điểm xuất phát với đích là bằng nhau cho dùng người chơi chọn điểm xuất phat nào.
- **Answer (English):** C - the image is only a concept. Make the distance from the start point to the finish equal no matter which start point the player chooses.
- **Status:** confirmed
- **BA note:** Confirmed. Option C: every start requires the same swim distance to Lý Sơn; the start changes only scenery and map path (FR-40, FR-41, FR-22, BR-17; BR-07 superseded; AMB-02 resolved). Q-25 (distance value) and Q-26 (km vs %) were reworded to match; they had not been asked yet.

### Q-07: Language of the app
- **Question:** In which language(s) should the app be shown to players and organizers? The concept image is in Vietnamese; the documents are in English.
- **Why it matters:** Supporting two languages from the start affects every screen, email and message; adding it later costs more.
- **Related:** NFR-16, SRC-14
- **Options:**
  - A) Vietnamese only.
  - B) English only.
  - C) Vietnamese and English, user can switch.
  - D) Vietnamese now, English later.
- **Answer (original):** C
- **Answer (English):** C (Vietnamese and English, user can switch).
- **Status:** confirmed
- **BA note:** Confirmed. Option C: Vietnamese and English, user can switch (NFR-16, FR-69). Follow-up: default language and whether user-entered content is translated (Q-40). Risk R-10 notes the copy/translation effort.

### Q-08: Who can create tournaments
- **Question:** Who is allowed to create a tournament, and how does someone become a platform admin?
- **Why it matters:** Decides whether we need an organizer application/approval flow and admin tools to grant roles.
- **Related:** G-03, A-07, FR-09, FR-21
- **Options:**
  - A) Any registered user can create a tournament.
  - B) Only users a platform admin has approved as organizers; the first admin is set up by the operator.
  - C) Only the SwimQuest team creates tournaments for now.
  - D) Other (please describe).
- **Answer (original):** Mỗi người chơi được tạo tối đa 3 giải đấu trong suốt vòng đời của tài khoản, nếu muốn hơn phải request và được admin approve.
- **Answer (English):** Each player can create at most 3 tournaments over the whole lifetime of their account; to create more they must submit a request and have it approved by an admin.
- **Status:** confirmed
- **BA note:** Confirmed. Any player may create tournaments and becomes the organizer of each one (FR-09, FR-21); limit of 3 per account lifetime, more after a platform admin approves a request (FR-70, BR-21). The answer does not say how platform admins are created; the BA does not ask a separate question for this and keeps it as assumption A-07 (first admin set up by the operator, existing admins can grant the role), shown to the stakeholder at sign-off. What counts toward the 3 is assumption A-11. Risk R-11: without email verification, extra accounts can get around the limit.

### Q-09: One swim, several tournaments
- **Question:** If a player is in two tournaments at the same time, does one verified swim count for both?
- **Why it matters:** Affects duplicate rules, the score ledger and whether players need to choose a tournament when submitting.
- **Related:** G-04, A-06, FR-30, FR-46
- **Options:**
  - A) Yes, a swim counts for every tournament the player is active in on that date.
  - B) No, the player picks one tournament per swim.
  - C) A player may only be in one active tournament at a time.
  - D) Other (please describe).
- **Answer (original):** a
- **Answer (English):** A (yes, a swim counts for every tournament the player is active in on that date).
- **Status:** confirmed
- **BA note:** Confirmed. One verified swim counts for every tournament the player is active in on that date, toward their team in each (FR-30, FR-46, BR-22); A-06 confirmed. Follow-up: who reviews a swim that needs a person when it counts for several tournaments (Q-42). Risk R-12: with per-tournament extra rules (Q-36), one swim may count in one tournament and not another.

### Q-10: Tournaments, seasons and routes
- **Question:** Is a tournament the same as one season, and is Route 01 the only route organizers can use?
- **Why it matters:** Decides whether organizers manage seasons inside a tournament and whether they choose a route and a "scoring version" or these are fixed.
- **Related:** AMB-01, AMB-03, G-19, A-02, A-03, FR-21, FR-23
- **Options:**
  - A) One tournament = one season; Route 01 and its scoring rules are fixed; the organizer only sets dates, capacity and route distances.
  - B) A tournament can contain several seasons; Route 01 is the only route for now.
  - C) Organizers can choose among several routes and scoring versions (please describe which).
- **Answer (original):** Hiện tại mới có route 01, tương lai sẽ thêm nhiều route nữa, khi tạo giải, ban tổi chức có thể chọn tuyến và set up thể lệ (em có thể suggest thêm).
- **Answer (English):** For now there is only Route 01; more routes will be added in the future. When creating a tournament, the organizer ("ban tổi chức" is a typo for "ban tổ chức") can choose the route and set up the rules/regulations ("thể lệ") (you can suggest more).
- **Status:** confirmed
- **BA note:** Confirmed. Route 01 is the only route now; the organizer picks the route when creating a tournament from a list that can grow later (FR-73), and sets up the tournament's rules (thể lệ) (FR-74). "Scoring version" as a field is replaced by these rules. AMB-03 and G-19 resolved; A-02 confirmed. The stakeholder invited suggestions: the BA's proposed list of organizer settings is follow-up Q-44 (nothing in it is decided until accepted). The answer does not mention seasons, so the BA keeps assumption A-03 (one tournament = one season, one date range) for sign-off rather than asking again (AMB-01).

### Q-11: Team size and solo players
- **Question:** What are the team size rules: minimum and maximum members, and can someone take part alone (without a team)?
- **Why it matters:** Affects validation, the start-selection lock (what if a team is too small at season start) and fairness between big and small teams.
- **Related:** G-05, FR-31, FR-36
- **Options:**
  - A) Each tournament sets its own maximum (for example 12 as in the concept image); minimum 1; no solo play outside teams.
  - B) Fixed platform limits (please give min and max); no solo play.
  - C) Solo players are allowed (as a one-person team).
  - D) Other (please describe).
- **Answer (original):** BTC giải tạo đội chơi và giới hạn số người tham gia của từng đội. BTC cũng có thể chuyển đổi các người chơi từ đội này sang đội khác. Ban tổ chức còn có thể chỉ định một người chơi làm đội trưởng.
- **Answer (English):** The tournament organizer ("BTC") creates the teams and limits the number of participants of each team. The organizer can also move players from one team to another. The organizer can also appoint a player as team captain.
- **Status:** confirmed
- **BA note:** Confirmed ("BTC" = organizer (ban tổ chức)). The organizer creates teams, sets a size limit per team, moves players between teams and appoints the captain (FR-31 rewritten, FR-75, FR-76; BR-26). This changes the design, where a player creates a team and becomes its captain (SRC-6, SRC-14 step 3); see C-11. FR-36 confirmed: a player is in one team per tournament at a time. Not covered by the answer, asked as follow-ups: how players get into a team, whether players can still create teams, and what happens to a player without a team (Q-45); what a captain can still do (invites, approvals, start choice, handover) (Q-46). Q-12 (changes after the lock) and Q-22 (capacity and dates) were reworded to fit. Minimum team size and solo play were not answered; under this model a team the organizer creates with a limit of 1 is a one-person team, so the BA asks nothing separate (assumption A-15).

### Q-12: Changing teams after the lock
- **Question:** You decided the organizer can move players from one team to another. After the start choice is locked and the season has begun, which team changes are still allowed, and which team do a player's earlier swims count for?
- **Why it matters:** The specs require an explicit policy to prevent score exploits (for example moving a strong swimmer to a team that is close to the finish in the middle of the season).
- **Related:** G-06, FR-34, FR-75, Q-11
- **Options:**
  - A) Teams are frozen at the lock: nobody joins, leaves or is moved during the season.
  - B) During the season the organizer can still move players and add new players; each swim stays with the team the player was in on the swim's date.
  - C) As B, but when a player is moved, the swims they already made move with them to the new team.
  - D) Other (please describe, for example whether a player can leave a team on their own).
- **Answer (original):** C
- **Answer (English):** C (as B, but when a player is moved, the swims they already made move with them to the new team).
- **Status:** confirmed
- **BA note:** Confirmed option C. During the season the organizer can still move players and add new players (consistent with Q-22 B); a moved player's earlier swims in that tournament, with their points, bonuses and multipliers, move to the new team, so the old team's progress goes down and the new team's goes up (FR-75, FR-34, BR-31). If the old team drops below 100%, Q-13 applies (finish withdrawn); the new team may reach the finish through the move. Risk R-13: moving a strong swimmer with their points can push a team over the finish; only the organizer can move players and every move is audited. Not covered by the answer: whether a player can leave a team on their own and what a captain's removal does with the player's swims → follow-up Q-50.

### Q-13: When a finished team loses progress
- **Question:** If a team reached Lý Sơn (100%) and later a swim is revoked so they drop below 100%, what happens to their finish?
- **Why it matters:** The specs require a completion-correction policy; it affects rewards, badges and leaderboards.
- **Related:** G-07, FR-42, FR-47
- **Options:**
  - A) The finish is withdrawn (badge and finish removed) until they reach 100% again.
  - B) The finish stays; only the numbers are corrected.
  - C) An admin decides case by case, with a recorded reason.
  - D) Other (please describe).
- **Answer (original):** A
- **Answer (English):** A (the finish is withdrawn, badge and finish removed, until they reach 100% again).
- **Status:** confirmed
- **BA note:** Confirmed option A. Whenever a finished team drops below 100% (a revoked swim, a recalculated weekly multiplier, or a player moved out with their swims per Q-12), the finish is withdrawn: the finish record and the Lý Sơn badge are removed until the team reaches 100% again (FR-42, FR-47, BR-32). Assumed (A-18), shown at sign-off: team members are told when a finish is withdrawn; reaching 100% again creates a new finish with the new time, and that time is used for ranking ties.

### Q-14: Points, XP and leaderboard ranking
- **Question:** How should personal XP, tournament points and "consistency" be earned, and what ranks teams on the leaderboard?
- **Why it matters:** The specs name these scores but give no rules; we cannot build or test them without rules.
- **Related:** G-08, AMB-08, FR-49, FR-50, FR-51
- **Options:**
  - A) First release: rank teams by route progress % only (tie-break: earlier time); no XP/points yet.
  - B) Simple rules: XP per verified distance, a consistency bonus for active weeks; leaderboard by progress %.
  - C) Other (please describe the rules).
- **Answer (original):** Em tự đề xuất luật tính (ví dụ, bơi đều đặn thì x bao nhiêu %, buổi bơi đầu tiên được bao nhiêu, bơi dài > 1000m được bao nhiêu, ...).
- **Answer (English):** You propose the scoring rules yourself (for example, regular/consistent swimming multiplies by how many %, how much the first swim earns, how much a long swim > 1000 m earns, ...).
- **Status:** confirmed
- **BA note:** Confirmed only as "the BA proposes the scoring rules; the stakeholder accepts or adjusts them". The rules themselves are NOT decided: the concrete proposal (with numbers) is follow-up Q-43, and FR-49, FR-50, FR-51 stay provisional until the stakeholder answers it.

### Q-15: Badges and the finish reward
- **Question:** Which badges should exist, how is each one earned, and where can the finish summary be shared?
- **Why it matters:** The art plan lists 4 badges and the concept image 8; neither says how they are earned.
- **Related:** C-07, G-09, G-20, FR-42, FR-51
- **Options:**
  - A) The 4 from the art plan (explorer, teamwork, consistency, route finisher); please give the rule for each.
  - B) The 8 from the concept image (participation, explorer, perseverance, teamwork, conqueror, season, special, Lý Sơn); please give the rule for each.
  - C) Only a "route finisher" badge in the first release; more later.
  - D) Other (please describe). For sharing: a link, a downloadable image, or social networks?
- **Answer (original):** B - BA dề xuất luật.
- **Answer (English):** B (the 8 badges from the concept image) - the BA proposes the rules. ("dề xuất" is a typo for "đề xuất".)
- **Status:** confirmed
- **BA note:** Confirmed only as "the 8 badges of the concept image (participation, explorer, perseverance, teamwork, conqueror, season, special, Lý Sơn); the BA proposes the rules" (FR-51; C-07 resolved). The award rules are NOT decided: the BA's proposal is follow-up Q-51, which also covers where the finish summary can be shared (that part of Q-15 was not answered; G-20).

### Q-16: Collectibles, ships and levels
- **Question:** The art shows coins, pearls, chests, map fragments, team ship tiers 1-3 and player levels ("Lv 12"). What do they do in the game?
- **Why it matters:** Without rules they are just decoration; with rules they need an economy, storage and screens.
- **Related:** G-10, FR-61
- **Options:**
  - A) Decoration only for now (no rules).
  - B) Ship tier grows with team progress; level grows with XP; collectibles appear at milestones (please describe).
  - C) Leave them out of the first release.
  - D) Other (please describe).
- **Answer (original):** B - ba đề xuất.
- **Answer (English):** B (ship tier grows with team progress; level grows with XP; collectibles appear at milestones) - the BA proposes the details.
- **Status:** confirmed
- **BA note:** Confirmed only as option B with the details proposed by the BA (FR-82). The details (tier thresholds, level curve, which collectible appears when and what it is for) are NOT decided: the proposal is follow-up Q-52.

### Q-17: How users are notified
- **Question:** How should users receive notifications (invitations, team updates, verification results, milestones)?
- **Why it matters:** Each channel (in-app, email, phone push) is separate work and email/push need sending services.
- **Related:** G-11, FR-17, FR-53
- **Options:**
  - A) In-app only.
  - B) In-app and email.
  - C) In-app, email and phone push notifications.
  - D) Other (please describe).
- **Answer (original):** In app và push notification của pwa và thêm option Zalo bot notification qua nhóm Zalo(em có thể tham khảo game RunnerWars trên máy anh).
- **Answer (English):** In-app and PWA push notifications, and add an option for Zalo bot notifications through a Zalo group (you can refer to the RunnerWars game on my machine).
- **Status:** confirmed
- **BA note:** Confirmed (option D). Channels: in-app (notification list with history) and PWA push; no email notifications (FR-53, FR-17). An optional Zalo bot posting to a Zalo group per tournament is added (FR-83). The BA read RunnerWars as the stakeholder suggested and recorded its behaviour in `sources/runnerwars-zalo-reference.md` (SRC-16): there the organizer connects their own bot per event, the first group the bot hears from becomes the event's group, the bot only posts (in Vietnamese) intro, new teams, joins, team switches, start, every counted run and results, and the organizer switches each kind on or off. SwimQuest's version is not decided by the answer: follow-ups Q-54 (setup and linking) and Q-55 (messages). New risks R-16 (Zalo's built-in browser), R-17 (iPhone push needs iOS 16.4+ and the app on the Home Screen), R-18 (group privacy).

### Q-18: Personal data export, deletion and tracking consent
- **Question:** What should happen when a player asks to export or delete their data, how long do we keep data, and do we need a consent banner for analytics?
- **Why it matters:** The specs say this must be defined before public launch; it affects legal compliance and audit history (scores already counted for a team).
- **Related:** G-12, G-22, FR-10, NFR-06, R-06
- **Options:**
  - A) Export as a downloadable file; deletion removes personal data but keeps anonymized swims in team totals; analytics without personal data, no consent banner.
  - B) Same as A, with a consent banner for analytics.
  - C) Handle export/deletion manually by email for now; build it later.
  - D) Other (please describe, including any legal requirements you must follow).
- **Answer (original):**
- **Answer (English):**
- **Status:** deferred
- **BA note:** Deferred with the stakeholder's agreement ("đồng ý hoãn Q-18 và Q-28", stakeholder-notes.md, 2026-10-15). Reason: release 1 goes to staging only (A-09), and the sources say this policy must be defined "before public launch". FR-10 (export/deletion), NFR-06 retention and G-12/G-22 are decided and built before a production launch. Must be reopened if Q-29 puts a public launch in release 1.

### Q-19: Who makes the production art
- **Question:** The concept image is only a reference. Who will produce the final art (landmarks, swimmer sprites and animations, ships, sea life, badges, icons)?
- **Why it matters:** The squad can integrate art and build the asset catalogue, but cannot paint premium 2.5D art; without a source, screens need placeholders.
- **Related:** G-13, C-08, FR-61, FR-62, R-03
- **Options:**
  - A) You will provide or commission the art; we build with simple placeholders and swap them in when delivered.
  - B) First release uses simple, clean placeholder/vector art; premium art later.
  - C) Other (please describe). Please also say whether the butterfly stroke (shown in the image, not in the art plan) is needed.
- **Answer (original):** đã có ảnh concept rồi, claude tự cắt và làm theo swimquest-full-platform-ui-concept.md và ui-ux-and-visual-system.md
- **Answer (English):** The concept image already exists; Claude should cut it up itself and follow swimquest-full-platform-ui-concept.md and ui-ux-and-visual-system.md.
- **Status:** confirmed
- **BA note:** Confirmed. Release 1 art is cut from the concept image by the squad, following the concept description (SRC-14) and SRC-11 (layout, palette, accessibility); no outside artist (FR-61, FR-62, NFR-12 updated). This overrides the design pack's "never slice the concept board" (SRC-11 §Art asset status, SRC-12 §Production specifications); recorded as C-12, resolved by this answer. Honest limits recorded in R-03: the image is one 1536×1024 picture, so most items are small (roughly 40-100 pixels across) and sit on a light card background; the seven landmarks are painted into the map, not separate; the map has destination labels painted in (NFR-10 says no text in art); swimmers are a few small poses, not 8-frame animation loops; several required items are not in the image at all (app icon, at least 8 team emblems (4 shown), default avatars, map marker states, ocean tile, energy orb, some effects). How to handle these is follow-up Q-47. The butterfly part of the original question was not answered; because the stakeholder asked to follow the concept description, which shows four strokes, the BA keeps assumption A-14 (butterfly included) for sign-off.

### Q-20: Main navigation
- **Question:** Which main menu should the mobile app have? The spec says Home, Tournaments, My Team, Voyage, Profile; the concept image shows Home, Tournaments, Activity, Team, More (and another screen shows Home, Map, Activity, Leaderboard, Team).
- **Why it matters:** The menu decides how players reach every screen.
- **Related:** C-03, FR-60
- **Options:**
  - A) Home, Tournaments, My Team, Voyage, Profile (spec).
  - B) Home, Tournaments, Activity, Team, More (concept image).
  - C) Other (please list).
- **Answer (original):** 20.a
- **Answer (English):** A (Home, Tournaments, My Team, Voyage, Profile, as in the spec).
- **Status:** confirmed
- **BA note:** Confirmed option A: mobile bottom bar Home, Tournaments, My Team, Voyage, Profile (FR-60). C-03 resolved.

### Q-21: Tournament privacy options
- **Question:** You decided that each tournament has one invite link, and players who come through it choose a team. Should tournaments also be listed for everyone to find? (The written spec has public / unlisted / private tournaments and open / approval / invite-only joining; the concept image shows "Public" and "Invite code".)
- **Why it matters:** It decides whether the tournament list (with its "Join" buttons in the concept image) shows tournaments to everyone, what the create-tournament form asks, and whether the organizer must accept each player.
- **Related:** C-06, FR-25, FR-27, FR-28, FR-80, Q-45
- **Options:**
  - A) Link only: tournaments are never listed for everyone; the only way in is the invite link.
  - B) The organizer chooses per tournament: "Public" (shown in the tournament list; any signed-in player can open it and choose a team) or "Invite link only" (not listed).
  - C) As B, and the organizer can also require their approval before a player who joins is accepted.
  - D) Other (please describe).
- **Answer (original):** 21.B
- **Answer (English):** B (the organizer chooses per tournament: "Public", shown in the tournament list, or "Invite link only", not listed).
- **Status:** confirmed
- **BA note:** Confirmed option B. Per tournament the organizer chooses "Public" (listed; any signed-in player can open it and choose a team) or "Invite link only" (not listed). No organizer approval to join (option C not chosen; consistent with Q-49). FR-25, FR-27, FR-28 updated; C-06 resolved.

### Q-22: Tournament capacity and dates
- **Question:** Since the organizer creates the teams and sets each team's size, the number of places in a tournament comes from the teams. Should a tournament have a registration period separate from the season dates (as in the written spec), or only one date range (as in the concept image)?
- **Why it matters:** It decides the create-tournament form, when players can join, and whether people can still join after the season has started.
- **Related:** C-05, FR-21, FR-23, FR-26, Q-11
- **Options:**
  - A) Separate dates: registration opens and closes, then the season starts and ends (spec).
  - B) One date range (season start and end); players can join from publishing until the season ends.
  - C) One date range (season start and end); joining closes when the season starts.
  - D) Other (please describe).
- **Answer (original):** B
- **Answer (English):** B (one date range, season start and end; players can join from publishing until the season ends).
- **Status:** confirmed
- **BA note:** Confirmed option B. A tournament has one date range (season start and end); players can join from publishing until the season ends, also after the start-choice lock (they join a team whose start is already set) (FR-21, FR-22, FR-23, FR-26, BR-33). There is no separate registration window, so the life cycle becomes DRAFT → PUBLISHED (joining open, season not started) → ACTIVE (season running, joining still open) → COMPLETED → ARCHIVED. The tournament's capacity is the sum of its teams' limits. C-05 resolved.

### Q-23: Distance units
- **Question:** Which distance units should be supported?
- **Why it matters:** Affects input, display, conversion and rounding of progress.
- **Related:** G-15, FR-13
- **Options:**
  - A) Metric only (meters / kilometers).
  - B) Metric and yards/miles, chosen per player.
  - C) Other.
- **Answer (original):** 23.a
- **Answer (English):** A (metric only: meters / kilometers).
- **Status:** confirmed
- **BA note:** Confirmed option A: metric only (NFR-21); the profile has no unit preference (FR-13); the route distance is entered in km (FR-40). G-15 resolved.

### Q-24: Time zone for deadlines
- **Question:** Which time zone do tournament dates and the start-selection deadline use?
- **Why it matters:** Decides exactly when the lock happens and which day a swim belongs to, and so also the daily limit, the "one long-swim bonus per day" rule and the Monday-to-Sunday week of the consistency multiplier.
- **Related:** G-16, FR-39
- **Options:**
  - A) Vietnam time (UTC+7) for everything.
  - B) Each tournament sets its own time zone.
  - C) Other.
- **Answer (original):** 24.a
- **Answer (English):** A (Vietnam time, UTC+7, for everything).
- **Status:** confirmed
- **BA note:** Confirmed option A: Vietnam time (UTC+7) for season dates, deadlines, the start-choice lock, the swim's day, the daily limit, the one-long-swim-bonus-per-day rule and the Monday-to-Sunday week (NFR-20, FR-39). G-16 resolved. Assumed (A-26), shown at sign-off: a swim belongs to the day it started.

### Q-25: The route distance
- **Question:** You decided that every start has the same distance to Lý Sơn. How long is that distance, and who sets it?
- **Why it matters:** Every tournament needs this number before it can be published; it decides how long a season takes for a team.
- **Related:** G-17, FR-40, FR-22, Q-06
- **Options:**
  - A) One fixed distance for all tournaments (please give it, for example 100 km).
  - B) A default distance (please give it) that the organizer can change per tournament before publishing.
  - C) The organizer always sets it per tournament, no default.
- **Answer (original):** C.
- **Answer (English):** C (the organizer always sets it per tournament, no default).
- **Status:** confirmed
- **BA note:** Confirmed. The organizer enters the route distance for each tournament; there is no default and publishing is blocked until it is set (FR-40, FR-22, FR-73). One value for all starts (Q-06). G-17 resolved. Units follow Q-23 (still open).

### Q-26: Leaderboard tabs and showing kilometers
- **Question:** You accepted two team leaderboard tabs: "Progress" (the ship's position, ties broken by who reached it first) and "Points" (team points). Because points now move the ship, these two tabs only differ after a team reaches Lý Sơn (the ship stops there, points keep counting). The concept image also has "Total km" and "Badges" tabs. Which tabs should the team leaderboard have?
- **Why it matters:** Each tab is a separate ranking to build, test and explain. "Total km" would be the only ranking by real distance swum, since points include bonuses and multipliers.
- **Related:** C-04, AMB-04, FR-50, Q-43, Q-48, Q-51
- **Options:**
  - A) Progress and Points only.
  - B) Progress, Points and Total km (verified km swum in the season, without bonuses).
  - C) Progress, Points, Total km and Badges (number of badges earned by the team's members).
  - D) Other (please describe).
- **Answer (original):** 26.C.
- **Answer (English):** C (Progress, Points, Total km and Badges tabs).
- **Status:** confirmed
- **BA note:** Confirmed option C: four team leaderboard tabs (FR-50); AMB-04 and C-04 resolved. Details kept as assumption A-21 for sign-off: "Total km" counts the verified km that count in the tournament (after its longest-swim and daily limits), without bonuses; "Badges" counts badges earned in this tournament by the team's current members.

### Q-27: Tournament eligibility rules
- **Question:** What eligibility rules can an organizer set for who may join a tournament?
- **Why it matters:** Eligibility is required but undefined; each rule needs data we must collect from players.
- **Related:** G-14, FR-26, FR-30
- **Options:**
  - A) None in the first release (free text "eligibility notes" only).
  - B) Simple rules such as age range or region (please list).
  - C) Other (please describe).
- **Answer (original):** 27.A
- **Answer (English):** A (no eligibility rules in the first release; free-text "eligibility notes" only).
- **Status:** confirmed
- **BA note:** Confirmed option A: no eligibility rules checked by the system; the organizer may write free-text eligibility notes shown on the tournament page (FR-21, FR-26, FR-30, BR-12). The eligibility part of G-14 is resolved; the minimum-age part stays deferred (Q-28).

### Q-28: Minimum age
- **Question:** Is there a minimum age to use SwimQuest, and may minors take part?
- **Why it matters:** Minors usually need parental consent and stricter privacy and safety handling.
- **Related:** G-14, R-06, NFR-05
- **Options:**
  - A) 18+ only.
  - B) 13+ (or another age), with stricter privacy defaults for minors.
  - C) Other (please describe).
- **Answer (original):**
- **Answer (English):**
- **Status:** deferred
- **BA note:** Deferred with the stakeholder's agreement ("đồng ý hoãn Q-18 và Q-28", stakeholder-notes.md, 2026-10-15). Reason: on staging (A-09) only invited test players use the app, so the age policy matters at public launch; it is decided before a production launch. Must be reopened if Q-29 puts a public launch in release 1.

### Q-29: Launch audience and timeline
- **Question:** Who is the first audience (a closed pilot or the public), roughly how many players, and is there a target date (for example the "SwimQuest Mùa Đông 2026" season starting 01/11/2026 in the concept image)?
- **Why it matters:** Shapes the first-release cut, performance needs and which risks matter most.
- **Related:** G-21, NFR-17, Q-01
- **Options:**
  - A) Small closed pilot (under 100 players), no fixed date.
  - B) Pilot with a fixed start date (please give it).
  - C) Public launch (please give expected size and date).
- **Answer (original):** 29.A
- **Answer (English):** A (small closed pilot, under 100 players, no fixed date).
- **Status:** confirmed
- **BA note:** Confirmed option A: closed pilot, under 100 players, no fixed date (NFR-17; G-21 resolved). No public launch in release 1, so Q-18 and Q-28 stay deferred. Where the pilot runs is not stated; the BA keeps assumption A-09 (the pilot plays on staging, production is a later decision), shown at sign-off.

### Q-30: Public handles
- **Question:** Should players have a unique public handle (like @name) in addition to a display name?
- **Why it matters:** Handles need uniqueness rules and change rules; the spec leaves it open.
- **Related:** AMB-06, FR-20
- **Options:**
  - A) No, display name only.
  - B) Yes, a unique handle.
- **Answer (original):** 30. Tên hiện thị là tên swimer đăng ký lúc sign up
- **Answer (English):** The display name is the name the swimmer registers at sign-up. ("hiện thị" is a typo for "hiển thị"; "swimer" = swimmer.) The stakeholder did not pick A or B explicitly.
- **Status:** confirmed
- **BA note:** Confirmed as option A in substance: the answer names only the display name and describes no handle, so there is no separate public handle (FR-20 dropped; AMB-06 resolved). New detail applied: the display name is entered at sign-up (FR-01). Not stated, and not worth another round because the design pack already covers it: whether the name can be changed later and whether it must be unique. The BA keeps the design's behaviour as assumption A-27, shown at sign-off: editable in My Profile (FR-12), not unique.

### Q-31: What teammates see
- **Question:** Can teammates always see each member's swim distance (as in the concept image roster), or can a player hide it with privacy settings?
- **Why it matters:** Privacy settings and the team roster must agree.
- **Related:** AMB-07, FR-16, FR-52
- **Options:**
  - A) Teammates always see each member's verified contribution; privacy settings apply to people outside the team.
  - B) Players can hide their contribution even from teammates.
  - C) Other.
- **Answer (original):** 31.A
- **Answer (English):** A (teammates always see each member's verified contribution; privacy settings apply to people outside the team).
- **Status:** confirmed
- **BA note:** Confirmed option A (FR-16, FR-52). AMB-07 resolved. Zalo group messages are a separate exception chosen in Q-55 (R-18).

### Q-32: Repository assessment step
- **Question:** The documents ask for a repository assessment and say not to start implementation until you authorize it. The repository has no code yet. Do you agree that this assessment is skipped and that your approval of the requirements and then of the stories authorizes building?
- **Why it matters:** Avoids producing an assessment of an empty repository and makes the authorization point explicit.
- **Related:** C-10, C-01, A-08
- **Options:**
  - A) Yes: skip the assessment; requirement and story approvals authorize building.
  - B) No: I want a separate written plan (phases, risks, test plan) before any building starts.
  - C) Other (please describe).
- **Answer (original):** 32. a
- **Answer (English):** A (skip the repository assessment; requirement and story approvals authorize building).
- **Status:** confirmed
- **BA note:** Confirmed option A. C-10 resolved; A-08 confirmed. GATE 1 and GATE 2 approvals are the owner's authorization to build.

### Q-33: What "prepared but not enabled" means for sign-in
- **Question:** For Strava, Google and Facebook sign-in, you asked us to "prepare them to be ready but not enable them yet". What should exist in release 1?
- **Why it matters:** Fully building and testing each provider needs a developer account and approval with that company and adds work to release 1; building it later costs less now but means a new release to turn it on.
- **Related:** Q-05, AMB-10, G-23, FR-04, FR-05, FR-64, NFR-03, NFR-04
- **Options:**
  - A) Fully built and tested, but switched off; an admin can turn each one on later without new development.
  - B) Only the account structure allows extra sign-in methods later; no provider is built in release 1 and no buttons are shown.
  - C) Buttons are shown as "coming soon" but do nothing; building comes later.
  - D) Other (please describe).
- **Answer (original):** C
- **Answer (English):** C (buttons are shown as "coming soon" but do nothing; building comes later).
- **Status:** confirmed
- **BA note:** Confirmed. Release 1 shows "Continue with Strava/Google/Facebook" as "coming soon" buttons that do nothing (FR-04, FR-64). Linking/unlinking and separate import status (FR-05, FR-06) and the OAuth rules (NFR-03, NFR-04) move to a later release. AMB-10 and G-23 resolved.

### Q-34: Which swim sources work in release 1
- **Question:** You want many options in the Connect section, with GPX/FIT upload as the release 1 priority, and you named Strava, Garmin, Coros and Suunto as trusted sources. In release 1, which of these should players actually be able to use, and how should the others appear?
- **Why it matters:** Each connection to Strava, Garmin, Coros or Suunto is a separate integration needing the company's developer approval, so it adds a lot of work and outside waiting time. Apple Health cannot be read from a web app, so Apple Watch users would upload a file.
- **Related:** Q-03, Q-04, AMB-09, FR-06, FR-67, R-01, R-08
- **Options:**
  - A) Only GPX/FIT upload and manual entry work in release 1; Strava, Garmin, Coros and Suunto are shown in Connect as "coming soon".
  - B) Same as A, but the other sources are built and switched off (like Q-33 option A).
  - C) GPX/FIT upload, manual entry and some connections work in release 1 (please say which, for example Strava).
  - D) Other (please describe).
- **Answer (original):** a
- **Answer (English):** A (only GPX/FIT upload and manual entry work in release 1; Strava, Garmin, Coros and Suunto are shown in Connect as "coming soon").
- **Status:** confirmed
- **BA note:** Confirmed. Release 1 intake = GPX/FIT upload and manual entry; Strava, Garmin, Coros, Suunto listed in Connect as "coming soon" (FR-67, FR-44, FR-45). Building those connections is a later release; R-01 and R-08 no longer affect release 1. AMB-09 resolved.

### Q-35: Who reviews manual swim entries
- **Question:** You said manual entries must be reviewed by a person, and flagged swims and disputes go to the organizer. Who approves or rejects manual entries?
- **Why it matters:** It decides who sees the review queue, who gets the review screens, and how quickly players see progress.
- **Related:** Q-04, G-18, FR-66, FR-48, FR-29
- **Options:**
  - A) The organizer of the tournament, who may appoint helpers to review.
  - B) Platform admins only.
  - C) The organizer reviews; players can appeal a rejection to a platform admin.
  - D) Other (please describe).
- **Answer (original):** a
- **Answer (English):** A (the organizer of the tournament, who may appoint helpers to review).
- **Status:** confirmed
- **BA note:** Confirmed. Manual entries, flagged swims and disputes are reviewed by the tournament's organizer or review helpers the organizer appoints (FR-66, FR-48, new FR-71, BR-24; actor "Review helper"). No appeal to a platform admin was chosen (option C not picked); admins still handle exceptional cases (FR-54). G-18 resolved. Follow-up for swims counting in several tournaments: Q-42. Round 6 update: with manual entry out of release 1 (Q-38), the organizer and helpers review flagged swims and disputes only; manual entries join the queue in a later release.

### Q-36: Automatic check rules
- **Question:** For swims from trusted sources (GPX/FIT and later connected apps), which checks should accept a swim automatically? A swim that fails a check goes to the organizer.
- **Why it matters:** These rules decide how many swims need a person and how hard cheating is; we cannot build or test the checks without them.
- **Related:** Q-04, FR-68, FR-46, R-07
- **Options:**
  - A) Standard checks: the activity is a swim; its date is inside the season; it is not a duplicate (same file or overlapping time as an existing swim); the pace and distance are realistic (limits set by the platform admin).
  - B) Same as A, and each organizer can tighten the limits for their tournament.
  - C) Other (please describe, including any limits you want, for example a maximum distance per swim).
- **Answer (original):** như A và ban tổ chức khi tạo sự kiện thì sẽ có thêm những ràng buộc ví dụ buổi bới tối thiểu là bao nhiêu mét, pace tối thiểu bao nhiêu, ...
- **Answer (English):** Like A, and when the organizer creates an event they will have additional constraints, for example the minimum distance of a swim ("buổi bới" is a typo for "buổi bơi") in meters, the minimum pace, ...
- **Status:** confirmed
- **BA note:** Confirmed ("event" (sự kiện) = tournament). Standard checks of option A, with realistic pace/distance limits set by a platform admin (FR-68), plus per-tournament extra rules the organizer sets when creating the tournament (FR-72, BR-25). Not asked again, kept as assumption A-12 for sign-off (AMB-11): "minimum pace" read as the slowest pace allowed; rule types = minimum distance per swim and pace limit. Follow-up Q-41: what happens to a swim that fails an extra rule.

### Q-37: Which swims count
- **Question:** Do pool swims count toward the team's progress, or only open-water swims?
- **Why it matters:** Watch files mark pool and open-water swims differently; this changes the automatic checks and the safety messaging.
- **Related:** Q-04, FR-68, NFR-07
- **Options:**
  - A) Both pool and open-water swims count the same.
  - B) Only open-water swims count.
  - C) Both count, but differently (please describe).
- **Answer (original):** A - vì mùa đông người chơi sẽ bơi hồ.
- **Answer (English):** A - because in winter players will swim in pools.
- **Status:** confirmed
- **BA note:** Confirmed. Pool and open-water swims count the same (FR-68, BR-23). The automatic "is a swim" check accepts both kinds.

### Q-38: What a manual entry contains
- **Question:** When a player enters a swim by hand, what must they provide for the reviewer?
- **Why it matters:** Decides the entry form and what the reviewer can check.
- **Related:** Q-03, FR-66
- **Options:**
  - A) Date, distance, duration, pool or open water, and a required proof (photo or screenshot).
  - B) The same, but the proof is optional.
  - C) Other (please describe).
- **Answer (original):** Loại luôn phương thức nhập tay trong release 1.
- **Answer (English):** Remove the manual entry method entirely from release 1.
- **Status:** confirmed
- **BA note:** Confirmed (option C, "other"). Manual entry moves to a later release; what it contains is decided then. Consistent updates: Q-03's "manual entry needs review" and BR-19 apply when manual entry is built; Q-35's reviewers (organizer and helpers) remain in release 1 for flagged swims and disputes only; Q-44 item 4 ("manual entries allowed") moves to the later release with it; FR-66 later release; FR-44, FR-45, FR-48, FR-65, FR-67, FR-71 and BR-24 updated. Release 1 review work that remains: swims that fail a standard automatic check (FR-68) and disputes (including disputes about a missed extra rule, Q-41), per tournament (Q-42). Assumption A-20 (shown at sign-off): manual entry is not shown at all, not even as "coming soon". New risk R-15: players without a watch or swim app cannot record swims, and some pool-swim GPX exports carry no distance.

### Q-39: Password reset without email verification
- **Question:** Release 1 does not verify email addresses. How should a player who forgets their password get back in?
- **Why it matters:** A reset link sent to an unverified email may go to a mistyped or someone else's address; without any reset, players who forget their password are locked out.
- **Related:** Q-01, G-24, FR-03, R-09
- **Options:**
  - A) Reset link sent by email anyway (accepting the risk); verification can be added later.
  - B) No self-service reset in release 1; a platform admin resets the password on request.
  - C) Verify the email only when the player asks for a password reset (they prove they own it then).
  - D) Other (please describe).
- **Answer (original):** 39.b
- **Answer (English):** B (no self-service reset in release 1; a platform admin resets the password on request).
- **Status:** confirmed
- **BA note:** Confirmed option B: no reset email; a platform admin resets the password on request (FR-03, FR-18). G-24 resolved; R-09 narrowed. Assumed (A-25), shown at sign-off: "Forgot password?" explains how to contact the admin; the admin sets a temporary password (audited); the player must change it at the next login.

### Q-40: Default language and translated content
- **Question:** Which language should a first-time visitor see, and should content that organizers type (tournament names, descriptions, rules) also be available in both languages?
- **Why it matters:** Decides the first screen language and whether tournament forms need two versions of each text.
- **Related:** Q-07, G-25, FR-69, FR-21
- **Options:**
  - A) Vietnamese by default; organizer content is shown as typed (one language).
  - B) The phone/browser language (Vietnamese or English, otherwise English); organizer content as typed.
  - C) Either default, and organizers enter their texts in both languages.
  - D) Other (please describe).
- **Answer (original):** 40.A
- **Answer (English):** A (Vietnamese by default; organizer content is shown as typed, in one language).
- **Status:** confirmed
- **BA note:** Confirmed option A (FR-69, NFR-16). G-25 resolved.

### Q-41: A swim that misses an organizer's extra rule
- **Question:** Organizers can add extra rules to their tournament, for example a minimum distance per swim or a minimum pace. If a swim from a GPX/FIT file passes the standard checks but misses one of these extra rules, what should happen to it in that tournament?
- **Why it matters:** Sending every such swim to a person may fill the organizer's review queue with swims that are simply too short; not counting them automatically is faster but leaves no room for exceptions.
- **Related:** Q-36, G-26, FR-72, FR-68, FR-48
- **Options:**
  - A) It does not count for that tournament; the player sees which rule it missed. No review (the player can still raise a dispute).
  - B) It goes to the organizer's review queue, who decides whether it counts.
  - C) Each organizer chooses A or B for their tournament.
  - D) Other (please describe).
- **Answer (original):** a
- **Answer (English):** A (it does not count for that tournament; the player sees which rule it missed; no review, the player can still raise a dispute).
- **Status:** confirmed
- **BA note:** Confirmed. A GPX/FIT swim that passes the standard checks but misses a tournament's extra rule does not count in that tournament, with no review; the player sees which rule it missed and may raise a dispute, which goes to that tournament's review queue (FR-72, FR-48, BR-27). G-26 resolved.

### Q-42: Reviewing a swim that counts in several tournaments
- **Question:** One swim counts for every tournament the player is in. When that swim needs a person's review (a manual entry or a flagged swim), who decides?
- **Why it matters:** Each tournament has its own organizer and helpers; it decides whether the same swim appears in several review queues and whether it can count in one tournament but not in another.
- **Related:** Q-09, Q-35, G-27, FR-30, FR-48, FR-71
- **Options:**
  - A) Each tournament's organizer (or helpers) decides for their own tournament; the swim can count in one tournament and not in another.
  - B) The first decision by any of those organizers applies to all the player's tournaments.
  - C) The player picks one tournament to review it; that decision applies to all.
  - D) Other (please describe).
- **Answer (original):** a
- **Answer (English):** A (each tournament's organizer or helpers decide for their own tournament; the swim can count in one tournament and not in another).
- **Status:** confirmed
- **BA note:** Confirmed. A swim that needs a person appears in the review queue of each tournament it counts for; each organizer (or helper) decides only for their own tournament, and the player sees a separate status per tournament (FR-30, FR-48, FR-71, BR-28). G-27 resolved; R-12 updated.

### Q-43: The BA's scoring proposal (please accept or adjust)
- **Question:** You asked us to propose the scoring rules. Here is the proposal; nothing is decided until you accept or change it.
  1. **Distance points:** 10 points per verified km (1 point per full 100 m).
  2. **First swim bonus:** +20 points for a player's first verified swim in the tournament.
  3. **Long swim bonus:** +10 points for a verified swim of 1,000 m or more, or +25 instead for 3,000 m or more. At most one long-swim bonus per player per day.
  4. **Consistency multiplier (each week, Monday to Sunday):** an "active day" is a day with at least one verified swim of 500 m or more. 2 active days in a week: that week's distance points ×1.10 (+10%); 3 or more active days: ×1.20 (+20%). Streak: each earlier week in a row with 3+ active days adds another +5%, up to ×1.40 in total. The multiplier applies to distance points only (not to bonuses) and is added when the week ends.
  5. **Safety cap:** distance points count at most 10 km per player per day, so the game does not reward very long swims (safety rule NFR-07).
  6. **Team points** = the sum of its members' points in that tournament.
  7. **Route progress (the ship on the map)** uses verified distance only; points and bonuses never move the ship, so every team needs the same real distance to reach Lý Sơn.
  8. **Leaderboard:** the main team ranking is route progress (%), ties broken by who reached it first; a second "Points" tab ranks teams by team points.
  9. **Personal XP** (the player's level across all tournaments) uses the same rules, but each swim counts once even when it counts in several tournaments.
  10. If a swim is later revoked, its points, bonuses and XP are removed and the week's multiplier is recalculated.
  Example: in a player's first week they swim 1.2 km on Monday, 2 km on Wednesday and 3.2 km on Saturday (3 active days). Distance points 12 + 20 + 32 = 64, ×1.20 = 77; bonuses: first swim 20, long swims 10 + 10 + 25 = 45, so 65; week total 142 points.
- **Why it matters:** We cannot build or test points, XP, the leaderboard or the consistency badge without exact rules. Letting points move the ship would make teams that swim more often reach Lý Sơn with fewer real kilometers.
- **Related:** Q-14, G-08, AMB-08, FR-49, FR-50, FR-51, NFR-07, Q-26
- **Options:**
  - A) Accept the proposal as written.
  - B) Accept it with changes (please give the numbers or rules to change).
  - C) Accept it, but points also move the team's ship on the map (progress follows points instead of verified distance).
  - D) Other (please describe).
- **Answer (original):** C
- **Answer (English):** C (accept the proposal, but points also move the team's ship on the map: progress follows points instead of verified distance).
- **Status:** confirmed
- **BA note:** Confirmed with option C. Items 1-6 and 8-10 are accepted as written (FR-49, FR-50, FR-51, BR-29). Item 7 is replaced: team points (with bonuses and the weekly multiplier) move the ship, so teams that swim regularly reach Lý Sơn with fewer real km (FR-41, BR-30). Q-06/BR-17 still holds: every start has the same route length. Not determined by the answer, asked in follow-up Q-48: how many points one km of route is worth (Q-25 has the organizer enter the route in km), the exact finish condition, how a tournament's own point values (Q-44 item 7) change ship speed, and the clash between the 10 km daily points cap (item 5) and the 15 km daily limit accepted in Q-44 item 2 (C-13). Q-26 reworded: the Progress and Points tabs are accepted.

### Q-44: Extra tournament settings the organizer can choose (BA suggestion)
- **Question:** You said the organizer chooses the route and sets up the tournament rules (thể lệ), and invited us to suggest more. Already decided: route, route distance, dates, the teams with their size limits and captains, review helpers, a minimum distance per swim and a pace limit. We suggest these extra settings per tournament (each with a default the organizer can keep):
  1. **Longest swim counted:** a single swim counts only up to this distance (default 10 km).
  2. **Daily limit per player:** at most this distance counts per player per day (default 15 km), for safety.
  3. **Swim type:** pool and open water both count (default), or only one of them.
  4. **Manual entries allowed:** yes (default) or no for this tournament, to limit the review work.
  5. **Submission deadline:** a swim must be submitted within this many days of the swim date (default 7) and no later than this many days after the season ends (default 3).
  6. **Start-choice deadline:** when the captain's start choice locks (default: the season start).
  7. **Point values:** keep the platform scoring (Q-43) or change its numbers for this tournament.
  8. **Written rules text (thể lệ):** free text shown on the tournament page, in addition to the settings above.
- **Why it matters:** Every setting adds work to the create-tournament form, the automatic checks and the tests, and players need to understand the rules of each tournament. Settings not chosen now can be added later.
- **Related:** Q-10, Q-36, Q-37, FR-72, FR-74, FR-39, NFR-07, Q-43
- **Options:**
  - A) All eight settings, with the defaults above.
  - B) Only some of them (please list the numbers, and any defaults to change).
  - C) None of them: keep only the settings already decided.
  - D) Other (please describe, including any setting we did not list).
- **Answer (original):** A
- **Answer (English):** A (all eight settings, with the proposed defaults).
- **Status:** confirmed
- **BA note:** Confirmed option A: all eight settings with the proposed defaults (FR-78, FR-74). Item 3 lets an organizer narrow BR-23 (pool and open water both count) for their own tournament only. Item 6 default (season start) matches FR-39. Two items interact with Q-43 option C and are covered by follow-up Q-48: item 2 (15 km daily limit) vs Q-43 item 5 (10 km daily points cap) (C-13), and item 7 (point values), which now also changes how fast ships move. Round 6 update: Q-48 replaced item 2's default with one 10 km daily limit and fixed item 7's details; Q-38 moved item 4 (manual entries allowed) to a later release.

### Q-45: How players get into a team
- **Question:** You decided the organizer creates the teams, limits each team's size, moves players and appoints captains. The design also lets players create their own team and join a team by invitation or request. How does a player who joins a tournament get into a team?
- **Why it matters:** It decides the team screens (the concept image has "Create team / Join team" for players), the invitation and join-request features, and what a player sees while they have no team.
- **Related:** Q-11, C-11, FR-31, FR-32, FR-33, FR-75, SRC-14 step 3
- **Options:**
  - A) The organizer places every player in a team; players cannot choose or create teams. Until placed, the player sees "waiting for a team" and their swims do not count in that tournament.
  - B) Players pick one of the organizer's teams that still has room (or ask to join it); the organizer can move them later. Players cannot create teams.
  - C) As B, and players may also propose a new team, which the organizer must approve.
  - D) Other (please describe).
- **Answer (original):** Người chơi tạo giải (lúc này người chơi thành ban tổ chức của giải đó), mỗi giải có một link mời, btc tạo đội và người chơi vào từ link mời có thể chọn một đội tham gia, btc có thể chuyển đổi đội của người chơi.
- **Answer (English):** A player creates the tournament (at that point the player becomes the organizer of that tournament). Each tournament has one invite link. The organizer ("btc") creates the teams, and a player who comes in through the invite link can choose one team to join. The organizer can change a player's team.
- **Status:** confirmed
- **BA note:** Confirmed ("btc" = organizer (ban tổ chức)). The creator becomes the tournament's organizer (matches Q-08); each tournament has one invite link (FR-80); only the organizer creates teams, players cannot create or propose teams (FR-31; C-11 resolved: the concept image's "Create team" form is an organizer function); a player who opens the link joins the tournament by choosing one team (FR-28); the organizer can change a player's team (FR-75). Follow-ups: whether tournaments are also listed for everyone besides the link (Q-21 reworded, C-06); how choosing a team fits with the captain's invites and join approvals accepted in Q-46 (Q-49). Assumed (A-17), shown at sign-off: a full team cannot be chosen; the organizer can switch the link off or replace it (the old link then stops working).

### Q-46: What a captain can do
- **Question:** The organizer appoints the captain. Which of these can the captain still do?
- **Why it matters:** The design gives the captain many powers (invite and approve members, remove members, hand over captaincy, choose the start beach); Q-11 moves some of them to the organizer, and each power needs its own screens and permission checks.
- **Related:** Q-11, C-11, FR-32, FR-33, FR-35, FR-38, FR-76
- **Options:**
  - A) Only choose the start beach before the lock and edit the team's name, emblem and description; everything about members and captaincy is done by the organizer.
  - B) As A, plus invite members and approve join requests (within the team's size limit); removing members and changing the captain stay with the organizer.
  - C) As B, plus remove members and hand the captaincy to another member (as in the design); the organizer can still override.
  - D) Other (please describe).
- **Answer (original):** C
- **Answer (English):** C (as B, plus remove members and hand the captaincy to another member, as in the design; the organizer can still override).
- **Status:** confirmed
- **BA note:** Confirmed option C. The captain chooses the start before the lock, edits the team's name, emblem and description, invites members and approves join requests within the team's limit, removes members and hands the captaincy to another member; the organizer can override all of these (FR-32, FR-33, FR-35, FR-38, FR-81). A-16 (organizer may choose the start) is confirmed by the override. Follow-ups: how captain invites and approvals work with the tournament's single invite link, where players choose their own team (Q-49); what happens to a removed player and their swims (Q-50).

### Q-47: Art the concept image cannot provide well
- **Question:** You asked us to cut the art from the concept image. It is one 1536×1024 picture, so: most items in it are small (about 40-100 pixels across) and sit on a light card background; the seven landmarks are painted into the map, not separate; the map has the beach names painted in; swimmers are a few small poses, not smooth animations; and some items are not in it at all (app icon, at least 8 team emblems (only 4 shown), default avatars, map markers, ocean background, energy orb, some effects). How should we handle what the image cannot provide well?
- **Why it matters:** Cut-out items will look soft or blurry when shown larger and may keep traces of the background; we cannot invent painted art of the same quality. It decides what the game looks like on staging and whether the asset list must plan for replacements.
- **Related:** Q-19, C-12, FR-61, FR-62, NFR-10, NFR-12, R-03
- **Options:**
  - A) Use the cut-outs as they are; anything missing or unusable is drawn by us as simple flat vector (SVG) art in the same colors; swimmers move as a whole (gliding, bobbing) instead of frame-by-frame strokes.
  - B) Same as A for release 1, and you will provide better art later; the asset list marks each cut-out or simple asset so it can be replaced.
  - C) You will provide a larger version of the image, or separate images per asset group, before we build the art (please say when).
  - D) Other (please describe).
- **Answer (original):** B và hãy note lại nhưng asset nào cần được thay để anh có thể design và thay thế.
- **Answer (English):** B, and please note down which assets need to be replaced so that I (the stakeholder) can design and replace them. ("nhưng" is a typo for "những".)
- **Status:** confirmed
- **BA note:** Confirmed option B plus the stakeholder's request ("anh" = the stakeholder; "nhưng" read as "những"). Release 1 uses the cut-outs; missing or unusable items are drawn by the squad as simple flat vector (SVG) art in the palette; swimmers move as a whole (gliding, bobbing) (FR-61). The squad keeps an asset replacement list the stakeholder can read (FR-77): every cut-out or simple asset, with its id, what it shows, where it is used, its current source (cut-out / simple vector), the size, format and frames a replacement needs, and what is wrong with the current version; replacing an asset means delivering a file that meets that spec under the same id, with no other change. G-30 resolved; R-03 updated.

### Q-48: How points move the ship (BA proposal, please accept or adjust)
- **Question:** You chose that points (with bonuses and the weekly multiplier) move the team's ship. To make this exact, we propose the following; nothing is decided until you accept or change it.
  1. **Route length in points:** the organizer still enters the route distance in km (Q-25). The route length in points = route km × the tournament's points per km (10 by default). So with the defaults 1 point moves the ship 100 m of route, and a 100 km route needs 1,000 team points.
  2. **Ship position and finish:** the ship's position = team points ÷ route length in points, shown as a % and as "route km" (points ÷ points per km), for example "68 / 100 route km · 68%". The team reaches Lý Sơn when its points reach the route length in points. The ship then stays at Lý Sơn; members keep earning points (for the Points tab) and XP.
  3. **Tournament point values (Q-44 item 7):** the organizer may change every number of the scoring (points per km, first-swim bonus, long-swim bonuses and their distances, the multiplier steps and maximum). Because the route length in points follows the points per km, plain swimming always moves the ship at the same speed (100 m swum = 100 m of route); larger bonuses or multipliers make teams that swim regularly arrive sooner. The values lock when the season starts.
  4. **One daily limit:** you accepted a 10 km daily cap for points (Q-43 item 5) and a 15 km daily limit per tournament (Q-44 item 2). We propose a single setting, the tournament's daily limit, default 10 km, which caps both the distance that counts and the distance points.
  5. **Personal XP** always uses the platform values (Q-43), not a tournament's changed values, and counts each swim once.
  Example with the defaults: a player who swims 2 km on 3 days a week earns 60 distance points × 1.20 = 72, plus 3 long-swim bonuses = 30, so 102 points: the ship moves about 10 route km for 6 km swum (about 70% faster than the km swum; up to about 90% faster with a long streak). Organizers should keep this in mind when they set the route distance.
- **Why it matters:** Without a fixed link between points and the route, we cannot place the ship, decide when a team has finished, or tell organizers how long a season will take. The two daily limits you accepted contradict each other.
- **Related:** Q-43, Q-44, Q-25, Q-06, C-13, G-31, FR-40, FR-41, FR-49, FR-78
- **Options:**
  - A) Accept the proposal as written.
  - B) Accept it with changes (please give the items or numbers to change, for example 15 km as the daily limit).
  - C) Other (please describe).
- **Answer (original):** 44. a (stakeholder confirmed when asked: "Đúng, Q-48 = A")
- **Answer (English):** A (accept the proposal as written). The stakeholder typed "44. a"; when the PM asked whether this meant Q-48, they confirmed: "Yes, Q-48 = A".
- **Status:** confirmed
- **BA note:** Confirmed option A (the PM verified that "44. a" meant Q-48). All five items applied: route length in points = route km × points per km (default 10) (BR-34); ship shown as % and route km, finish when points reach the route length, ship stays at Lý Sơn while points and XP keep counting (FR-41); organizers may change every scoring number, locked at season start (FR-78 item 7, FR-49); one daily limit per tournament, default 10 km, capping both counted distance and distance points (FR-78 item 2, BR-29; C-13 resolved); XP always uses platform values (FR-51). G-31 resolved. R-14 stays: organizers should know bonuses make ships faster than the km swum.

### Q-49: Choosing a team and the captain's invites and approvals
- **Question:** Players who open the tournament's invite link choose a team (Q-45), and captains can invite members and approve join requests within the team's limit (Q-46). How do these fit together?
- **Why it matters:** It decides whether a player is in a team the moment they choose it, whether captains get an approval list, and what a player sees while waiting.
- **Related:** Q-45, Q-46, G-32, FR-28, FR-32, FR-33, FR-80
- **Options:**
  - A) Choosing a team with room joins it at once, without approval. A captain "invites" by sharing the tournament link with their team already selected.
  - B) Choosing a team sends a join request; the team's captain (or the organizer) approves or rejects it. Until then the player is in the tournament without a team, and their swims count only from the day they join a team. A player the captain invites directly joins without approval.
  - C) The organizer decides per tournament whether A or B applies.
  - D) Other (please describe).
- **Answer (original):** 49.A
- **Answer (English):** A (choosing a team with room joins it at once, without approval; a captain "invites" by sharing the tournament link with their team already selected).
- **Status:** confirmed
- **BA note:** Confirmed option A. Choosing a team with room joins it at once, without approval (BR-36, FR-80); a captain invites by sharing the tournament link with their team preselected (FR-32). Consequence: there are no join requests, so the "approve join requests" power accepted in Q-46 has nothing to act on and FR-33 is dropped (shown in understanding.md so the stakeholder can catch it). G-32 resolved. Assumed (A-22), shown at sign-off: the player can still pick another team with room from a preselected link.

### Q-50: Leaving a team and being removed
- **Question:** The organizer can move a player to another team, and the player's swims go with them (Q-12). Captains can remove members (Q-46). What happens when a player leaves a team or is removed from it?
- **Why it matters:** Because swims move with a player, letting players switch teams on their own lets a strong swimmer carry their points to a team close to the finish; keeping the swims with the old team prevents that but works differently from the organizer's moves. A removal also takes progress away from the team, which can withdraw a finish (Q-13).
- **Related:** Q-12, Q-46, Q-13, G-33, FR-34, FR-35, FR-75
- **Options:**
  - A) Players cannot leave on their own; they ask the captain or the organizer. A removed player stays in the tournament without a team and may choose another team with room; their swims go with them, as with a move.
  - B) Players can leave a team on their own and choose another team with room; leaving or being removed takes their swims with them, as with a move.
  - C) Leaving or being removed takes the player out of the tournament; the swims they made stay with the team.
  - D) Other (please describe).
- **Answer (original):** Khi giải đã bắt đầu thì không được rời hoặc chuyển đội,
- **Answer (English):** Once the tournament has started, players may not leave or switch teams.
- **Status:** confirmed
- **BA note:** Confirmed only for what the answer says (option D): once the tournament has started, a player cannot leave their team or switch teams (BR-35, FR-28, FR-34). "Started" read as the season start; before the start no swim counts, so the BA assumes players may leave or switch then, and a removed player can choose another team (A-19). The answer names no subject and ends with a comma, and it conflicts with earlier answers: Q-12 C lets the organizer move players during the season (with their swims), and Q-46 C lets the captain remove members with no time limit (C-14, AMB-12). The BA does not choose: follow-up Q-53 asks whether the rule also binds the organizer and the captain, and what a removal after the start does to the player's swims. FR-75 and FR-35 are provisional for the after-start part until then.

### Q-51: Badge rules and sharing the finish (BA proposal, please accept or adjust)
- **Question:** You chose the 8 badges of the concept image and asked us to propose the rules. Proposal (nothing is decided until you accept or change it). Each badge can be earned once per tournament; the profile shows all badges from every tournament. An "active day" is a day with a verified swim of 500 m or more (as in the scoring).
  1. **Participation (Tham gia):** your first verified swim that counts in the tournament.
  2. **Explorer (Khám phá):** your team's ship passes the halfway point (50%) of the route. Given to every member of the team at that moment.
  3. **Perseverance (Kiên trì):** 3 or more active days a week for 4 weeks in a row.
  4. **Teamwork (Đồng đội):** in one week, every member of your team has at least one active day. Given to every member.
  5. **Conqueror (Chinh phục):** your verified swims in the tournament add up to 50 km.
  6. **Season (Mùa giải):** at least one active day in every full week (Monday to Sunday) of the season; awarded when the season ends.
  7. **Special (Đặc biệt):** given by the organizer to chosen players with a short reason (for example team spirit); recorded in the audit log.
  8. **Lý Sơn:** your team reaches Lý Sơn (100%). Given to every member at that moment, removed again if the finish is withdrawn (Q-13). The "HOÀN THÀNH" (Completed) emblem appears on the finish screen.
  9. A badge stays with a player who is moved to another team, except Lý Sơn as in item 8. If a revoked swim means a personal badge's rule is no longer met, that badge is removed.
  10. Badges give no points or XP, so they never change the race.
  11. **Sharing the finish:** a "Share achievement" button makes a picture (team name and emblem, route, finish date, team total) and a link to a public finish page with the same content. The player can save the picture or send either through the phone's own share menu (Zalo, Facebook, Messenger, ...). Personal details appear only as each player's privacy settings allow.
- **Why it matters:** We cannot build, test or show badges without exact rules, and the finish screen needs to know what "Share achievement" produces.
- **Related:** Q-15, G-09, G-20, FR-42, FR-51, NFR-07
- **Options:**
  - A) Accept the proposal as written.
  - B) Accept it with changes (please give the badges or numbers to change).
  - C) Other (please describe).
- **Answer (original):** 51.a
- **Answer (English):** A (accept the badge and sharing proposal as written).
- **Status:** confirmed
- **BA note:** Confirmed option A: all eleven items applied as written (FR-51 badge rules; FR-42 "Share achievement" picture and public finish page). G-09 and G-20 resolved.

### Q-52: Ships, levels and collectibles (BA proposal, please accept or adjust)
- **Question:** You chose: the ship tier grows with team progress, the level grows with XP, and collectibles appear at milestones, and asked us to propose the details. Proposal (nothing is decided until you accept or change it):
  1. **Ship tiers:** tier 1 from the start, tier 2 from 35% of the route, tier 3 from 70%. The ship follows current progress, so if progress drops (Q-13) the tier can drop too.
  2. **Levels:** everyone starts at level 1. Reaching level n needs 25 × n × (n − 1) XP in total: level 2 = 50 XP, 3 = 150, 4 = 300, 5 = 500, 10 = 2,250, 12 = 3,300, 20 = 9,500; no maximum. With the default scoring, a player who swims 2 km on 3 days a week earns about 100 XP a week (about level 8 after 4 months). The level is shown on the profile, home page and team roster and gives no advantage in the game. XP comes only from swims that count in at least one tournament; if XP is removed (revoked swim), the level can go down.
  3. **Collectibles** are for collecting only: no shop, no spending, no effect on points or the race. They are kept per tournament and shown on the team page and profile; if the swim or progress behind one is removed, the item is removed too.
     - Map fragment (team): one at 20%, 40%, 60% and 80% of the route; with Lý Sơn they complete the Route 01 voyage map shown on the team page.
     - Treasure chest (team): one at 50% and one at Lý Sơn, opened with the reward effect on the map.
     - Pearl (personal): one for each week with 3 or more active days.
     - Starfish (personal): one for each long-swim bonus (1,000 m or more).
     - Coin (personal): one for each verified km that counts in the tournament.
     - Energy orb (personal): shown on the player's swimmer while their weekly multiplier is active (2 or more active days that week); not collected.
  4. Marine life (dolphins, turtles, fish, ...) and the other items in the concept image (star, shell, message bottle) are decoration on the map only.
- **Why it matters:** Without these numbers ships, levels and collectibles are only pictures; with them we know what to store, show and test.
- **Related:** Q-16, G-10, FR-61, FR-82, Q-43
- **Options:**
  - A) Accept the proposal as written.
  - B) Accept it with changes (please give the items or numbers to change).
  - C) Other (please describe).
- **Answer (original):** 52.A
- **Answer (English):** A (accept the ships, levels and collectibles proposal as written).
- **Status:** confirmed
- **BA note:** Confirmed option A: ship tiers at 35% and 70%, level curve 25 × n × (n − 1) XP, collectibles for collecting only, marine life as decoration, applied as written (FR-82). G-10 resolved.

### Q-53: Who the "no leaving or switching after the start" rule applies to
- **Question:** You said that once the tournament has started, players may not leave or switch teams. Earlier you also decided that the organizer can still move players during the season, with their swims moving to the new team (Q-12), and that the captain can remove members (Q-46). Which of these applies after the start? (Before the start no swim counts yet, so we assume players can still leave or switch to another team with room then, and a removed player can choose another team; please tell us if that is wrong.)
- **Why it matters:** It decides whether teams are frozen at the start for everyone or only for players, whether the organizer keeps the "move player" tool during the season, and what a removal does to the team's progress (removing a member's swims can withdraw a team's finish, Q-13).
- **Related:** Q-50, Q-12, Q-46, Q-13, Q-22, C-14, AMB-12, G-33, FR-28, FR-34, FR-35, FR-75, BR-35
- **Options:**
  - A) The rule is only for players' own actions. After the start the organizer can still move players (their swims move with them, as in Q-12), and the captain or organizer can still remove a member: the removed player leaves the tournament and the swims they made stay with the team.
  - B) As A, but when a member is removed after the start, their swims are taken off the team (the team's progress goes down).
  - C) The rule is for everyone: from the start, teams are frozen. The organizer can move players and the captain can remove members only before the start. New players can still join a team with room during the season (Q-22).
  - D) Other (please describe).
- **Answer (original):** a (stakeholder confirmed when asked: "Đúng, Q-53 = A")
- **Answer (English):** A (the rule is only for players' own actions; after the start the organizer can still move players with their swims, and the captain or organizer can still remove a member, who leaves the tournament while their swims stay with the team). The stakeholder typed "a" without a number; when the PM asked, they confirmed: "Yes, Q-53 = A".
- **Status:** confirmed
- **BA note:** Confirmed option A (the PM verified that "a" meant Q-53). The Q-50 rule binds only players' own actions (BR-35). After the start the organizer can still move players with their swims (FR-75, BR-31) and the captain or organizer can still remove a member, who leaves the tournament while their swims stay with the team (FR-35, BR-37). The before-start reading stated in the question (A-19) was not corrected and is confirmed. C-14, AMB-12, G-33 resolved; R-13 kept as the stakeholder's accepted choice. Assumed (A-23), shown at sign-off: a member removed after the start cannot rejoin through the link (that would be a switch); only the organizer can add them back.

### Q-54: How a tournament's Zalo group is connected
- **Question:** You want an optional Zalo bot that sends notifications to a Zalo group, like RunnerWars. In RunnerWars, each event organizer creates their own Zalo bot, enters its key on the event, adds the bot to their Zalo group, and the group is linked when someone mentions the bot there. How should this work in SwimQuest?
- **Why it matters:** It decides who has to create a Zalo bot (every organizer, or only SwimQuest once), what the organizer sees in the tournament settings, and how much setup an organizer must do before their group gets messages.
- **Related:** Q-17, G-34, FR-83, SRC-16
- **Options:**
  - A) As in RunnerWars: each organizer creates their own Zalo bot, enters its key in the tournament settings and adds it to their group; the group is linked when the bot is first mentioned there. One bot can serve several of that organizer's tournaments.
  - B) SwimQuest has one official Zalo bot, set up once by a platform admin. The organizer adds that bot to their Zalo group and links the group to the tournament by following steps shown in the tournament settings.
  - C) Other (please describe).
- **Answer (original):** 54.a
- **Answer (English):** A (as in RunnerWars: each organizer creates their own Zalo bot, enters its key in the tournament settings and adds it to their group; the group is linked when the bot is first mentioned; one bot can serve several of that organizer's tournaments).
- **Status:** confirmed
- **BA note:** Confirmed option A: each organizer's own Zalo bot, key entered in the tournament settings, group linked by the first mention; the same bot on another of the organizer's tournaments posts to the same group, as in SRC-16 (FR-83). The bot key is protected (NFR-19).

### Q-55: What the Zalo bot posts
- **Question:** Which messages should the Zalo bot post to a tournament's group?
- **Why it matters:** Each message kind is separate work and testing. A busy group can get many messages (one per swim), and a Zalo group may include people who are not in the tournament, who would see players' names and swim data there regardless of their privacy settings.
- **Related:** Q-17, G-34, FR-83, FR-16, R-18, SRC-16
- **Options:**
  - A) As in RunnerWars, adapted to SwimQuest, in Vietnamese: the tournament introduction (dates, rules, invite link) when the group connects; each new team (with a link that preselects it); each player who joins (team and team size); a player moved to another team; the season start; every counted swim (who, distance, time, pace, points, team progress); milestones (a team passes a destination, reaches Lý Sơn, or loses its finish); the season end with the final leaderboard. The organizer can switch each kind off (all on by default); the introduction always goes out.
  - B) Only the big moments, in Vietnamese: introduction, season start, milestones (a team passes a destination, reaches Lý Sơn, or loses its finish) and the season end with the final leaderboard. No message per swim or per player.
  - C) As A or B, but messages in the language the organizer chooses for the tournament (Vietnamese or English) (please say A or B).
  - D) Other (please describe).
- **Answer (original):** 55.a
- **Answer (English):** A (as in RunnerWars, adapted to SwimQuest, in Vietnamese: all message kinds listed, each switchable by the organizer, all on by default; the introduction always goes out).
- **Status:** confirmed
- **BA note:** Confirmed option A: all eight message kinds, Vietnamese only, each switchable by the organizer except the introduction, all on by default (FR-83). G-34 resolved. Interplay noted: (1) with manual entry out of release 1 (Q-38), "every counted swim" means GPX/FIT swims that count in the tournament; (2) Vietnamese only is an exception to the bilingual rule of Q-07 (FR-69, NFR-16); (3) the question stated that group members outside the tournament see names and swim data regardless of privacy settings, so R-18 is the stakeholder's accepted risk; the organizer can switch per-swim and per-player messages off, and players are told on the tournament page (assumption A-24, shown at sign-off).

### Q-56: Organizer-set pace and distance limits (change after GATE 2)
- **Question:** At GATE 2 you said each tournament's organizer sets the pace and distance limits (signed-off FR-68 says a platform admin sets them). (a) Does the platform admin keep any limit? (b) What happens when a swim fails these limits? (c) Starting values?
- **Why it matters:** Changes FR-68, FR-72, BR-25, entity PlatformSwimLimits and stories S-12, S-26, S-27, S-64.
- **Related:** GATE 2 answer 1, Q-36, FR-68, FR-72, BR-25
- **Options:**
  - (a) A) The organizer sets the tournament's fastest pace, slowest pace and longest realistic swim, pre-filled with platform defaults and kept inside a wide platform-wide sanity bound the admin sets; S-64 becomes "admin sets defaults and bounds" (BA recommendation). B) The admin only sets the pre-filled defaults; organizers change them freely, no bound. C) No platform values at all; S-64 dropped.
  - (b) A) BA proposal: a swim outside these limits is still flagged to that tournament's review queue; missed extra rules still do not count and can only be disputed. B) Merge both into one set of organizer rules.
  - (c) BA proposal: fastest 1:05 per 100 m, slowest 5:00 per 100 m, at most 30 km per swim (separate from "longest swim counted"); values lock at season start.
- **Answer (original):** 1a. A, 1b.A, 1c. đồng ý.
- **Answer (English):** (a) A; (b) A (the BA proposal); (c) agreed.
- **Status:** confirmed
- **BA note:** Confirmed (post-GATE-1 change). (a) A: each tournament has its own realistic swim limits (fastest pace, slowest pace, longest realistic swim), set by the organizer as a tournament setting (FR-78 item 9), pre-filled with platform defaults and kept inside platform-wide sanity bounds; the platform admin sets the defaults and the bounds (FR-85 added). (b) A: a swim outside the tournament's realistic limits is flagged to that tournament's review queue; a swim that misses an extra rule (FR-72) still does not count and can only be disputed; the two sets stay separate. (c) Defaults: fastest 1:05 per 100 m, slowest 5:00 per 100 m, longest realistic swim 30 km (separate from "longest swim counted", default 10 km); the values lock at season start. Applied to FR-68, FR-72, FR-78, FR-85, BR-25, BR-38, actors, entities, scope. Consequence (already implied by Q-42): the same swim can pass the limits in one tournament and be flagged in another. Starting bound values are not needed from the stakeholder: the admin enters them (A-29).

### Q-57: How a start is assigned automatically (change after GATE 2)
- **Question:** At GATE 2 you said a team with no start at the lock is assigned one automatically. Which start is picked? Also to confirm: it happens at the start-choice deadline, is audited as a system action, team members get an in-app and push notice, the organizer sees "assigned automatically", and afterwards it is locked like a chosen start (only an admin exceptional correction can change it).
- **Why it matters:** Changes FR-38, FR-39, BR-02, FR-53 and stories S-10, S-37, S-65.
- **Related:** GATE 2 answer 2, FR-38, FR-39, BR-02, BR-17
- **Options:**
  - A) At random among the six starts.
  - B) The start the fewest teams in the tournament chose, ties at random (BA recommendation).
  - C) Always the first destination, Bãi biển Non Nước.
- **Answer (original):** thay đổi 2.B
- **Answer (English):** Change 2: B. (The stakeholder did not separately comment on the listed confirmations.)
- **Status:** confirmed
- **BA note:** Confirmed (post-GATE-1 change) option B: a team with no start at the start-choice deadline is given the start the fewest teams of the tournament have, ties broken at random (FR-84). The listed confirmations (at the start-choice deadline; audited as a system action; in-app and push notice to the team's members; the organizer sees "assigned automatically"; locked afterwards like a chosen start, only an admin exceptional correction can change it) were stated in the question as what would apply, and the stakeholder chose B without correcting them. As with A-19 in Q-53, the BA treats them as confirmed; no follow-up is needed. They are listed explicitly in understanding.md "Change after GATE 2", so the stakeholder's re-sign covers them; any correction there sends this back to Phase B. When several teams have no start, they are assigned one at a time in random order, each assignment counting for the next (assumption A-28, shown at the re-sign). Applied to FR-38, FR-39, FR-84, FR-29, FR-53, FR-55, BR-02, entities.

### Q-58: Season start and end date and time (change after GATE 2)
- **Question:** At GATE 2 you said the organizer chooses the season boundaries when creating the tournament. BA proposal: entered in Vietnam time, pre-filled 00:00 on the start date and 23:59 on the end date, end after start; a swim counts if its start time is inside; A-26 still applies to the daily limit and long-swim bonus; the start-choice deadline defaults to the season start time; the "days after season end" submission rule counts from the end time; weeks stay Monday to Sunday.
- **Why it matters:** Changes FR-21, FR-22, FR-23, FR-39, FR-68, FR-78 item 5, NFR-20, A-26 and stories S-04, S-10, S-12, S-24, S-33.
- **Related:** GATE 2 answer 4, NFR-20, A-26
- **Options:**
  - A) As proposed (BA recommendation).
  - B) Whole hours only.
  - C) Date and time required, no pre-fill.
- **Answer (original):** thay đổi 3. A,
- **Answer (English):** Change 3: A (as proposed).
- **Status:** confirmed
- **BA note:** Confirmed (post-GATE-1 change) option A: the organizer enters the season start and end as date and time in Vietnam time, pre-filled 00:00 on the start date and 23:59 on the end date; the end must be after the start; a swim counts in the season if its start time is inside the range; A-26 (a swim's day = the day it started) still governs the daily limit and the long-swim bonus; the start-choice deadline defaults to the season start time; the "days after season end" submission rule counts from the season end time; weeks stay Monday to Sunday. Applied to FR-21, FR-22, FR-23, FR-39, FR-68, FR-78 item 5 and item 6, NFR-20, BR-16, BR-33, entities.

<!-- Status values: open | answered | confirmed | deferred
     answered  = PM recorded an answer, BA has not processed it
     confirmed = BA applied it to requirements.md
     deferred  = stakeholder agreed to postpone; reason required in BA note -->
