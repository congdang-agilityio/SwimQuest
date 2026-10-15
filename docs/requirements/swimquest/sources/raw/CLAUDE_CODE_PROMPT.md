# Claude Code Prompt — SwimQuest Full Platform Design-to-Implementation

The owner has **not started implementation yet**. Treat this as preparation and repository discovery, not permission to make broad changes.

Read all documents in this pack and inspect the existing repository, `plan.md`, GDD, activity intake, verification and scoring logic.

## Required first output
Create a repository assessment that describes:
- existing modules and architecture;
- what can be reused;
- gaps for accounts, tournaments, teams and Route 01;
- visual assets available vs missing;
- risks, migration/backfill/rollback plan;
- proposed phase plan and test plan.

Do not start broad implementation until the owner explicitly approves it.

## Product decisions
- SwimQuest is a multi-tournament platform.
- Players can register/login and manage profiles through a dedicated player profile management page covering basic info, verified stats, activity history, tournaments/teams, badges, connected accounts (including Strava), privacy, notifications and security. Include optional Strava OAuth sign-in; keep Strava identity authentication separate from authorization to import activity data.
- Authorized organizers can create, configure and publish tournaments.
- Players can join tournaments under each tournament's visibility/join policy.
- Teams can be created, joined and managed with invitations/approvals.
- Each team selects one Route 01 start destination at season start; choice locks at deadline.
- Lý Sơn is the shared finish.
- Progress uses normalized route percentage.
- Only verified swim activities contribute.
- Preserve the existing validated activity intake, verification and scoring path.

## Visual requirements
- Premium stylized 2.5D ocean-adventure art; navy, turquoise, blue, coral, sand and gold palette.
- Mobile-first player experience plus desktop-friendly organizer console.
- Build reusable design tokens/components before screen-specific styling.
- Keep route labels/progress/UI separate from map artwork.
- Treat composite concept boards as references only; never ship them as individual sprites.
- Produce a production asset manifest, isolated landmarks, sprite sheets with frame metadata, generated contact sheet and QA gallery.

## Constraints
- Server-authoritative authorization, verification, scoring and progress.
- No public precise GPS.
- No unsafe swim incentives.
- Audit privileged actions and scoring changes.
- Avoid duplicate entities and unrelated architecture rewrites.
- Do not claim a feature or asset is complete without implementation/test evidence.

## Expected deliverables after approval
Phased implementation with tests, updated docs, working flows, asset QA, regression results and known risks. Stop and report when repository facts contradict assumptions in the design pack.


## Strava-specific constraints
- Treat Strava as an optional OAuth identity provider only after checking current official API policies and auth-provider capabilities.
- Never put a Strava client secret or tokens in frontend code.
- Validate state/CSRF, use the supported authorization-code flow, and follow current OAuth guidance.
- Do not silently merge accounts by email; require explicit authenticated linking.
- Sign-in must not automatically grant activity-import scopes or award route progress.
