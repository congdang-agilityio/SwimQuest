# S-56: Privacy settings and public profile

- **Priority:** P1
- **Covers:** FR-16, NFR-05 · **Decisions:** Q-31
- **Depends on stories:** S-55

## User story
As a player, I want to decide who sees each part of my profile, and preview it, so that I share only what I want.

## Acceptance criteria
1. **Settings**
   - Given I open "Privacy" on my profile
   - When I look at each profile field and my activity summary
   - Then I can set each to public, members only or private; email is private by default
2. **Others see only what is allowed**
   - Given I set my bio to private and stats to public
   - When another signed-in player who is not my teammate opens my profile (from a leaderboard, team roster or tournament page)
   - Then they see my stats and display name but not my bio
3. **Preview**
   - Given I am on Privacy
   - When I choose "Preview public profile"
   - Then I see my profile exactly as others outside my team see it
4. **Teammates**
   - Given my settings are private
   - When a teammate opens our team page
   - Then they still see my verified contribution to the team
5. **Never exposed**
   - Given any setting
   - When anyone else opens my profile
   - Then they never see my email, precise location, GPS tracks or moderation notes

## Out of scope
- Zalo group messages, which are outside these settings (S-89, R-18).

## Notes
- BA reading of "members only": visible to signed-in players who share a tournament with me.
