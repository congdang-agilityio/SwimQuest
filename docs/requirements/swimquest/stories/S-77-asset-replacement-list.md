# S-77: Asset replacement list for the stakeholder

- **Priority:** P1
- **Covers:** FR-77, FR-62 · **Decisions:** Q-47
- **Depends on stories:** S-18

## User story
As the stakeholder, I want a readable list of every cut-out or stand-in asset with what a replacement needs, so that I can design better art and drop it in.

## Acceptance criteria
1. **Every placeholder listed**
   - Given an asset is a cut-out from the concept image or a simple stand-in
   - When I open the asset replacement list
   - Then it appears with asset id, what it shows, where it is used in the app and its current source
2. **Replacement spec**
   - Given an asset in the list
   - When I read its row
   - Then I see the size, format, transparency and frame count a replacement needs
3. **What is wrong now**
   - Given an asset in the list
   - When I read its row
   - Then I see what is wrong with the current version (for example blurry when enlarged, background traces, missing animation)
4. **Drop-in replacement**
   - Given I deliver a file meeting the spec under the same id
   - When it is added
   - Then the app uses it with no other change and the list marks the asset as replaced
5. **Kept up to date**
   - Given an asset is added or replaced
   - When I open the list
   - Then it reflects the change

## Out of scope
- The technical manifest, contact sheet and QA gallery (S-92).

## Notes
- Readable by the stakeholder: plain English, viewable without tools (where it lives is the Team Lead's choice).
