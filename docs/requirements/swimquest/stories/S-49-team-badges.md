# S-49: Badges: Explorer, Teamwork and Lý Sơn

- **Priority:** P1
- **Covers:** FR-51, FR-42 · **Decisions:** Q-15, Q-51, Q-13
- **Depends on stories:** S-48, S-19

## User story
As a team member, I want badges for what my team achieves together, so that team effort is celebrated.

## Acceptance criteria
1. **Explorer**
   - Given my team's ship passes 50% of the route
   - When progress is updated
   - Then every member of the team at that moment gets the Explorer badge
2. **Teamwork**
   - Given in one Monday-to-Sunday week every member of my team had at least one active day
   - When the week ends
   - Then every member gets the Teamwork badge
3. **Lý Sơn**
   - Given my team reaches Lý Sơn
   - When the finish is recorded
   - Then every member at that moment gets the Lý Sơn badge
4. **Lý Sơn removed with the finish**
   - Given the finish is withdrawn (S-47)
   - When badges update
   - Then the Lý Sơn badge is removed from those members
5. **Moved players**
   - Given a player with Explorer and Lý Sơn badges is moved to another team
   - When the move completes
   - Then they keep Explorer and Teamwork but lose the Lý Sơn badge of the old team

## Out of scope
- Display on profile and team page (S-55).

## Notes
- Each badge at most once per tournament.
- BA reading of AC 5: FR-51 says badges stay with a moved player "except Lý Sơn".
