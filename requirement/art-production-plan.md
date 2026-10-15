# Art Production Plan — SwimQuest Platform + Route 01

## Phase A — UI foundations
- Design tokens, typography, spacing, elevation, borders, button/input/card components.
- Responsive layouts for mobile-first PWA and desktop organizer console.
- Auth form states, tournament cards, team cards, dialogs, toast, tabs, filters and navigation.
- Accessibility states, contrast, focus, loading skeletons and error/empty states.

## Phase B — Brand assets
- SwimQuest primary wordmark and compact mark (SVG source).
- PWA app icon and favicon.
- Tournament banner template.
- Team emblem set (at least 8 coherent variants).
- Default avatars and privacy-safe placeholder avatars.

## Phase C — Route 01 environments
Create isolated art assets, not a composite sheet:
- `landmark_non_nuoc`
- `landmark_son_thuy`
- `landmark_pham_van_dong`
- `landmark_man_thai`
- `landmark_hon_sup`
- `landmark_cu_lao_cham`
- `landmark_ly_son`
- Ocean background/tile, route overlay, compass, map markers (locked/active/completed).
Destination labels and progress remain UI layers.

## Phase D — Game assets
- Swimmer avatars with diverse appearance and swim gear.
- Swim animation sets: freestyle, backstroke, breaststroke, idle float, splash.
- Team ships tiers 1–3 and wake effects.
- Marine life: dolphin, turtle, fish school, jellyfish, coral, seaweed.
- Collectibles: coin, pearl, chest, map fragment, starfish, energy orb.
- Badges: explorer, teamwork, consistency, route finisher.
- VFX: small/large splash, sparkle, milestone glow, reward burst.

## Production specifications
- SVG for logo, UI icons and simple overlays.
- Transparent WebP/PNG for painted sprites.
- Landmark canvas suggestion 512×512 or 768×768; character frames should use a consistent canvas/pivot.
- Swim loops: 8 frames; idle/splash loops: 6 frames, unless art test indicates another frame count is better.
- Keep source masters; export compressed runtime assets.
- Asset manifest fields: id, path, width, height, format, alpha, frame count, frame size, pivot, source/license, usage.
- Contact sheets must be generated from actual delivered assets.
- Test art at 24/32/48 px icons and on mid-range mobile devices.
- Concept board is reference only, not sprite atlas.

## Asset acceptance
1. Style, lighting and palette consistent.
2. Each runtime object isolated and reusable.
3. Transparent alpha where required.
4. Animation frame dimensions/pivots align.
5. Manifest matches actual files.
6. No labels, card borders or watermarks baked into standalone sprites.
7. Loading fallbacks prevent runtime crash.
