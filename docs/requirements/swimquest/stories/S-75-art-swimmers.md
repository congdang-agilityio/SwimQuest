# S-75: Art: swimmer avatars and swim motions

- **Priority:** P1
- **Covers:** FR-61 · **Decisions:** Q-19, Q-47
- **Depends on stories:** S-18

## User story
As the stakeholder, I want swimmer figures for freestyle, breaststroke, backstroke and butterfly plus idle float and splash, so that the voyage feels alive.

## Acceptance criteria
1. **Four strokes**
   - Given the delivered swimmer art
   - When the stakeholder opens the asset list or QA gallery
   - Then freestyle, breaststroke, backstroke and butterfly swimmers exist as separate transparent images
2. **Idle float and splash**
   - Given the delivered art
   - When it is listed
   - Then idle float and splash images exist
3. **Used in the app**
   - Given my team is on the map
   - When I view Voyage
   - Then a swimmer appears with our ship
4. **Simple motion**
   - Given a swimmer is shown
   - When the page is open
   - Then it moves as a whole (gliding, bobbing), not frame by frame
5. **Reduced motion**
   - Given my device asks for reduced motion
   - When a swimmer is shown
   - Then it does not move

## Out of scope
- Frame-by-frame stroke animation (replacement art from the stakeholder later, FR-77).

## Notes
- A-14. AC 5: honouring reduced-motion settings is part of accessibility (NFR-10); kept by the stakeholder at GATE 2 (2026-10-15, "đúng", correct).
