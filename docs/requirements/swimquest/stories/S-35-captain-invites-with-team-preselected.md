# S-35: Captain invites players with the team preselected

- **Priority:** P1
- **Covers:** FR-32, FR-80 · **Decisions:** Q-46, Q-49
- **Depends on stories:** S-07, S-08

## User story
As a team captain, I want to share the tournament link with my team already selected, so that friends I invite land in my team.

## Acceptance criteria
1. **Way in**
   - Given I am a captain
   - When I open My Team
   - Then I see "Invite to team" with "Copy link" and the phone's share option
2. **Team preselected**
   - Given a player opens my shared link
   - When the join page appears
   - Then my team is already selected
3. **Joins at once**
   - Given my team has room
   - When the player confirms
   - Then they are in my team at once, without approval
4. **Can pick another team**
   - Given the join page opened with my team selected
   - When the player picks another team with room
   - Then they join that team instead
5. **Team full**
   - Given my team is full
   - When a player opens my link
   - Then they see that my team is full and can choose another team with room

## Out of scope
- Switching the link off (S-34).

## Notes
- A-22. The link follows the tournament link's rules (FR-80, A-17).
