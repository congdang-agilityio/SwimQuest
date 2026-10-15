# S-07: Join a tournament through its invite link by choosing a team

- **Priority:** P0
- **Covers:** FR-28, FR-80, FR-26, FR-36 · **Decisions:** Q-45, Q-49, Q-22, Q-27
- **Depends on stories:** S-06

## User story
As a player, I want to open a tournament's invite link and pick a team with room, so that I am in the game at once.

## Acceptance criteria
1. **Join by choosing a team**
   - Given I am signed in and open a published or active tournament's invite link
   - When I see the join page with the tournament's name, dates and its teams, and choose a team that has room
   - Then I am a member of that team immediately, without anyone's approval, and I land on My Team (S-17)
2. **Full teams cannot be chosen**
   - Given a team has reached its member limit
   - When I view the join page
   - Then that team is shown as full and cannot be chosen
3. **Not signed in**
   - Given I am not signed in
   - When I open an invite link
   - Then I am asked to log in or sign up, and afterwards I come back to the same join page
4. **One team per tournament**
   - Given I am already in a team of this tournament
   - When I open the invite link again
   - Then I see my current team and am not added a second time
5. **Last place taken at the same time**
   - Given a team has exactly one free place and two players choose it at the same moment
   - When both requests reach the server
   - Then only one of them joins; the other sees that the team is now full and can choose another team

## Out of scope
- Joining from the public tournament list (S-31); captain links with a preselected team (S-35); leaving or switching (S-38).

## Notes
- Joining is open from publishing until the season ends (BR-33); a link to a draft, completed or archived tournament shows that joining is closed.
- Eligibility notes are shown when present but never checked (Q-27; field added in S-29).
- A player removed after the start cannot rejoin through the link (A-23; S-41).
