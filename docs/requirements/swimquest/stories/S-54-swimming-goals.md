# S-54: Swimming profile: goals and preferred disciplines

- **Priority:** P1
- **Covers:** FR-13 · **Decisions:** Q-23
- **Depends on stories:** S-53

## User story
As a player, I want to note my swim goals and preferred disciplines, so that my profile reflects how I like to swim.

## Acceptance criteria
1. **Edit goals**
   - Given I am editing my profile
   - When I open "Swimming profile"
   - Then I can write swim goals and optionally pick preferred disciplines (for example pool, open water, strokes)
2. **Metric only**
   - Given I enter a goal distance
   - When I type it
   - Then it is in meters or kilometers; there is no unit choice
3. **Separate from verified stats**
   - Given I saved goals
   - When my profile is shown
   - Then goals appear in their own section, clearly apart from verified stats
4. **Safe wording**
   - Given the goals section
   - When I read its hints and examples
   - Then nothing encourages unsafe volume, pace, night swimming or swimming alone in open water
5. **Optional**
   - Given I leave goals empty
   - When I save my profile
   - Then it saves without them

## Out of scope
- Verified stats (S-55).
