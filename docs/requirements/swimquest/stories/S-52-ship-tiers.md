# S-52: Ship tiers follow team progress

- **Priority:** P1
- **Covers:** FR-82 · **Decisions:** Q-16, Q-52
- **Depends on stories:** S-14, S-18

## User story
As a team member, I want our ship to grow as we progress, so that our progress is visible at a glance.

## Acceptance criteria
1. **Tier 1 at the start**
   - Given my team's progress is below 35%
   - When I view Voyage, My Team or the leaderboard
   - Then our ship is shown as tier 1
2. **Tier 2 from 35%**
   - Given progress is at least 35% and below 70%
   - When the ship is shown
   - Then it is tier 2
3. **Tier 3 from 70%**
   - Given progress is at least 70%
   - When the ship is shown
   - Then it is tier 3
4. **Tier drops with progress**
   - Given progress falls below a tier's threshold
   - When the ship is shown
   - Then it shows the lower tier
5. **Tier upgrade moment**
   - Given my team just reached a new tier
   - When I next open Voyage
   - Then I see a short upgrade effect once

## Out of scope
- Ship art (S-18).

## Notes
- AC 5: the design pack's VFX (S-76) include milestone effects; the upgrade effect is a light BA addition, kept by the stakeholder at GATE 2 (2026-10-15, "đúng", correct).
