---
source: "requirement/backlog.md"
retrieved: 2026-10-15T00:37:38Z
converter: copy
---

# Implementation Backlog — Full SwimQuest Platform

## P0 — Repository discovery and architecture
- [ ] Inspect current repository, plan/GDD, validated activity intake, verification and scoring.
- [ ] Inventory existing auth, user, team, tournament, activity and score entities.
- [ ] Map reusable components and identify gaps; avoid duplicate systems.
- [ ] Write migration, backfill, rollback and regression plan.
- [ ] Confirm auth provider and tournament policy defaults before implementation.

## P1 — Identity foundation
- [ ] Add optional Strava OAuth sign-in via supported authorization-code flow.
- [ ] Add explicit link/unlink flow; do not silently merge accounts by email.
- [ ] Separate sign-in consent from activity-import authorization and validate current Strava policies/scopes.
- [ ] Registration/login/logout/reset/verification using selected auth architecture.
- [ ] Dedicated player profile management page: basic info, avatar, swimming stats, teams/tournaments, badges, activity history, privacy, notifications, connected accounts and security.
- [ ] Profile and privacy settings.
- [ ] Role and permission enforcement.
- [ ] Account lifecycle and audit events.
- [ ] Auth and security tests.

## P2 — Tournament foundation
- [ ] Tournament draft creation and validation.
- [ ] Publish/open/close/complete/archive lifecycle.
- [ ] Visibility, join policy, eligibility and capacity.
- [ ] Tournament discovery, details and join flow.
- [ ] Organizer console and audit controls.

## P3 — Team foundation
- [ ] Create team and roster.
- [ ] Invitations, join requests and approval.
- [ ] Captain/member roles and handover.
- [ ] Membership invariants and concurrency tests.

## P4 — Route 01 domain
- [ ] Seed seven destinations and common Lý Sơn finish.
- [ ] Configure per-start normalized route baselines.
- [ ] Implement one-time team start selection and lock.
- [ ] Normalized progress engine and versioned ledger.
- [ ] Reuse existing verified activity pipeline.

## P5 — UI and visual production
- [ ] Design system and responsive navigation.
- [ ] Auth, tournament, team and organizer screens.
- [ ] Route map and team dashboard.
- [ ] Generate isolated landmark and game sprites.
- [ ] Add asset registry, manifest and QA gallery.
- [ ] Add badges, items, VFX and finish experience.

## P6 — Analytics and launch readiness
- [ ] Instrument funnel and route events.
- [ ] Organizer metrics and fairness review.
- [ ] Run acceptance and regression suite.
- [ ] Conduct a small pilot and review fairness/safety.
- [ ] Document operational runbook and rollback.

## Definition of done
No phase is considered implemented until code, tests and evidence exist. Preserve the existing validated activity intake and scoring path. Do not begin implementation until owner authorizes it.
