# S-51: XP and levels

- **Priority:** P1
- **Covers:** FR-51, FR-82 · **Decisions:** Q-43, Q-48, Q-52
- **Depends on stories:** S-20, S-21

## User story
As a player, I want to earn XP from my swims and level up, so that I see my own long-term progress across tournaments.

## Acceptance criteria
1. **XP from swims, platform values**
   - Given my swim counts in at least one tournament
   - When XP is calculated
   - Then I get XP by the platform scoring rules (not any tournament's changed values)
2. **Each swim once**
   - Given my swim counts in two tournaments
   - When XP is calculated
   - Then it gives XP only once
3. **Levels**
   - Given my total XP
   - When my level is shown
   - Then I am at the highest level n for which 25 × n × (n − 1) ≤ my XP (level 2 at 50 XP, 3 at 150, 5 at 500, 10 at 2,250, 20 at 9,500), with no maximum
4. **Where it shows**
   - Given I have a level
   - When I open my profile, Home or my team roster
   - Then my level is shown, with XP to the next level on my profile
5. **Level can drop**
   - Given XP is removed after a revoked swim
   - When my total falls below my level's threshold
   - Then my level goes down

## Out of scope
- Badges (S-48 to S-50).

## Notes
- Levels give no game advantage (FR-82).
- XP stops counting swims that count nowhere (FR-82).
