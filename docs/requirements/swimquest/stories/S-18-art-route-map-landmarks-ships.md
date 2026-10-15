# S-18: Art: Route 01 map, landmarks and ships

- **Priority:** P0
- **Covers:** FR-61, FR-43, FR-82 · **Decisions:** Q-19, Q-47
- **Depends on stories:** none

## User story
As the stakeholder, I want the Route 01 map, the seven landmarks and the team ships cut out of the concept image (with simple stand-ins where needed), so that the voyage looks like SwimQuest from the first playable version.

## Acceptance criteria
1. **Map background without painted text**
   - Given the delivered map art
   - When it is shown in Voyage
   - Then it shows the ocean and coast of Route 01 with no destination names painted in (names come from the app as text)
2. **Seven landmarks**
   - Given the delivered landmark art
   - When the map is shown
   - Then each of the seven destinations has its own image placed on the map, cut from the concept image with the background removed, or a simple flat vector stand-in in the palette
3. **Ships tiers 1 to 3**
   - Given the delivered ship art
   - When a team's ship is shown
   - Then three ship tiers exist as separate transparent images, cut out or drawn as simple vector stand-ins
4. **Marked as cut-out or stand-in**
   - Given any of these assets
   - When the stakeholder checks the asset list (S-77)
   - Then each is listed with its source (cut-out or simple vector) and what a replacement needs
5. **Missing art does not break the map**
   - Given an image fails to load
   - When Voyage is shown
   - Then a simple fallback appears and the page still works

## Out of scope
- Other art sets (S-74, S-75, S-76); the full asset manifest and QA gallery (S-92).

## Notes
- Palette per NFR-11; no text in art (NFR-10, NFR-12).
- Concept image limits (R-03): landmarks are painted into the map and will be soft when enlarged.
