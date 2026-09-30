# FOOTBALL LEAGUE character design master

`assets/characters/design-master.png` is the unmodified reference supplied on
2026-09-30. It supersedes older character screenshots and sprite coordinates.
The renderer is authored as integer pixel shapes at 64 × 64; do not resize or
reuse the former 24 × 32 / 32 × 40 artwork as source geometry.

## Actual display paths

- `index.html` → `js/app.js` → `js/ui.js`:
  `renderLineupEditor` (formation), `renderSquadCard` (right roster), and
  `renderSquadComparison` (both profiles) → `squadAvatar` →
  `character-art.js: playerAvatar` → `drawCharacter`.
- `renderPlayerCard` (including home awards, roster dialogs and results) uses
  the same avatar entry. Club colors are passed explicitly in the squad UI.
- `app.js: renderDraftAvatar` / `auction-ui.js: renderLiveAuction` →
  `auctionAvatar` → the same `playerAvatar` cache.
- `arena-background.js` → `arena-scene.js: mountArena` → `actor` → complete
  pose frames from `arena-characters.js: pixelSideTexture` → `drawCharacter`.
  The old standing-sprite leg slicing is removed.
- Arena spectators, seated reserves, coaches and auction venue characters use
  the compatibility exports in `arena-characters.js`, backed by the new art.
  `living-background.js` and `three-background.js` are not loaded by the current
  entry HTML or its module graph.

## Appearance and motion

All 20 hair indices and all 7 face indices remain distinct. Existing avatar
profiles, seed, hair color and skin tone are read without changing player data.
Front and three-quarter views project the same individually authored hairstyle;
glasses, eyebrows and eye expressions follow that projection. There is no nose.
The hair and uniform have shadow, base and highlight tones. Thick limbs and
outlined white boots remain readable at small sizes.

Poses: `front`, `idle`, `run1`–`run4`, `dribble1`–`dribble2`, `pass`,
`kick1` (windup), `kick2` (follow-through), `back`, `coach`.
Right/left direction mirrors the complete sprite. Running changes head position,
head tilt, torso lean and opposing arm/leg poses, rather than moving cropped legs.
The arena's `footballTexture` and ball trajectory remain independent objects.

The shared cache includes the art version, complete appearance, kit and pose.
Entry HTML and every changed module import are versioned together so browsers
load the new renderer through the real UI graph.

Game logic, statistics, generation and league progression are unchanged.
Tests were not run, as requested; display connections were traced in source.
