# S-92: Asset manifest, contact sheet and QA gallery

- **Priority:** P2
- **Covers:** FR-62, NFR-12, NFR-15 · **Decisions:** Q-19
- **Depends on stories:** S-77

## User story
As the stakeholder, I want a complete asset manifest, a contact sheet and a gallery page of all art, so that I can review every asset in one place.

## Acceptance criteria
1. **Manifest**
   - Given the delivered assets
   - When I open the asset manifest
   - Then each asset has id, path, size, format, transparency, frames, pivot, source/licence (cut from the concept image or made otherwise) and usage
2. **Contact sheet**
   - Given the delivered assets
   - When the contact sheet is produced
   - Then it shows every asset as a thumbnail with its id, generated from the delivered files
3. **QA gallery**
   - Given I am a platform admin
   - When I open "Asset gallery" in the admin area
   - Then I see every asset rendered at its sizes on light and dark backgrounds
4. **Missing art falls back**
   - Given an asset file is missing
   - When a page uses it
   - Then a fallback is shown and nothing crashes; the gallery marks it missing
5. **Kept in step**
   - Given an asset is added or replaced
   - When the manifest and contact sheet are produced again
   - Then they match the delivered files

## Out of scope
- The stakeholder-facing replacement list (S-77).
