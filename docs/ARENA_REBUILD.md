# Arena rebuild — stage record

## Stage A — completed
- Target: dev/living-clubhouse-ui, baseline 82ce8d6fd1d4ab7c77e171acd011f95c659d462d.
- Clean branch cloned into arena-work; older v3 workspace untouched.
- Full-history backup: ../arena-before-rebuild.bundle; git bundle verify passed.
- Restore separately: git clone -b dev/living-clubhouse-ui ../arena-before-rebuild.bundle restored-arena.
- Existing new-game/load data attributes and game modules will be preserved.
- Player appearance will reuse three-background.js playerTexture (24 × 32 pixels).
- No merge, deployment or main modification.

## Stage B — completed
- Generated original empty architecture and alpha net with built-in image_gen (not API fallback).
- Source artwork preserved in assets/arena/source for reproducibility.
- Extracted tier fascia/rails and bench front edges from exact architecture coordinates; removed their original pixels from BASE to avoid duplicate architecture.
- Four runtime assets: arena-base.webp, foreground-railing.png, bench-front.png, goal-front-net.png. All 1672 × 941.
- Three PNGs verified RGBA with truly transparent pixels. Nets registered using projective transforms.

## Stage C — completed
- Replaced Three.js CDN background with local Canvas renderer. Removed obsolete prototype CSS block.
- One uniform cover transform for all artwork; no independently stretched assets.
- Crowd → railing, court actors → nets, bench backs → reserves → bench front.

## Stage D — completed
- Existing playerTexture 24 × 32 design reused; original spectator design reused.
- Cached static crowd plus selected cheering/jumping fans and checker flags; seating zones exclude stairs.
- Ten court players, ball, separate left/right bench reserves. Eighteen-second exhibition cycle.

## Stage E — completed
- Blank scoreboard and LED slots receive replaceable display content.
- Four fixture-aligned beams, sparse confetti, central title and real new/load action routes.
- Pause control, reduced-motion handling, 30fps ceiling, hidden-tab suspension and navigation cleanup.
- Title scene only: gameplay views, save format and simulation modules unchanged.

## Stage F — in progress
- 1600 × 900 real browser: artwork, seating density, rails, bench overlap, nets, display and central menu inspected.
- Fixed image decode incompatibility in embedded browser by using image load events with bounded fallback.
- New game successfully entered existing draft screen; Continue reached existing three-slot load screen.
- Existing suite: 35 pass / 5 fail. Exact same five failures reproduced on unmodified baseline, logged in baseline-tests.txt.

### Stage F — completed
- Real browser viewports: 1600 × 900 desktop, 390 × 844 portrait, 844 × 390 landscape. No horizontal overflow in landscape; portrait primary buttons 300 × 52px.
- 1,389 independently rendered seated spectators, selected animated fans, plus near silhouettes; 10 court players and 20 bench reserves.
- Verified New → setup → draft → auction → lineup; saved a disposable QA club to empty localhost slot 3; reloaded → Continue → slot 3 → restored lineup → simulated all 10 fixtures → season results.
- No production origin or existing production save was accessed. The localhost slot 3 contains “アリーナ確認用” for repeat verification.
- Navigating away removes the arena canvas. Pause snapshots compared byte-for-byte equal; resume works. Browser error log empty.
- Corrected both bench teams to retain consistent green/navy kits. Added kick/stride poses from original sprite and foreground supporter zone.
- Added transform/continuous exhibition-loop isolation tests: 2 pass. Full suite: 42 tests, 37 pass, same 5 baseline failures, no new failures.
- Evidence: arena-desktop.png, arena-mobile.png, arena-landscape.png; arena-tests.txt, baseline-tests.txt.

## Changed files
- index.html: loads arena stylesheet/module instead of Three.js prototype; app cache version updated.
- js/app.js: title markup only; new/load action attributes unchanged.
- css/style.css: removes previous living-background override block.
- css/arena.css: dedicated central title and responsive menu styling.
- js/arena-background.js: title scene lifecycle and graceful image failure fallback.
- js/arena-scene.js: coordinate transform, cached crowd, original sprite drawing, local-depth compositing, presentation clock, display/effects.
- assets/arena/{arena-base.webp,foreground-railing.png,bench-front.png,goal-front-net.png}: runtime layer art.
- assets/arena/source/{architecture.png,net.png}: original built-in image generation results.
- scripts/prepare-arena-assets.py: reproducible registered cutouts and alpha net warp.
- tests/arena.test.js: aspect-preserving transforms and continuous isolated exhibition.
- docs/ARENA_REBUILD.md, ARENA_ART_PROMPTS.md, screenshots and test logs.

## Remaining limitations
- The pre-existing five test failures remain intentionally outside this visual rebuild: two match-log wording assertions; duplicated special-ability expectations; contract aging expectation; substitute appearance count.
- Reduced-motion and hidden-tab suspension implemented; OS reduced-motion setting was not changed during browser QA.
- Mobile uses a central crop of the same arena; side goals and benches can be outside the portrait viewport.
- Art matches the reference composition/theme, not an exact reproduction. Existing block-style characters were retained as requested.
- Main, hosted site and game simulation/data/storage modules unchanged. No merge or deployment.
- Final runtime art total: 521,285 bytes (about 509 KiB); zeroed unused RGB behind alpha to avoid shipping the entire source image inside transparent layers.
- Final git diff whitespace check passed. New exhibition tests rerun after final animation adjustments: 2/2 pass.

## Character restoration — 0860bd5
- Restored pixelTexture, seatedBackTexture and coachTexture artwork directly from 0860bd579b08b540ff9cc51f94c58a00c1723315 into arena-characters.js.
- Retained original hair variants, outlines, shaded clothing, women/men supporter styles, back-facing substitutes and tracksuit coaches with clipboard/cap.
- Replaced Three.js texture wrappers with Canvas outputs and equivalent linear-light color conversion. Current arena layers and game logic retained.
- Both coaches placed beside the existing benches; scene module cache version updated.
- Per user request, no extra tests added or run; refreshed the existing preview to show the replacement.

## Goal, ball and open bench correction
- Moved both goalkeepers onto the court, outside the front-net polygons; goal zone now draws behind court actors. Updated shot/save endpoints to the new right goalkeeper position.
- Replaced the ball with a native 16px shaded football sprite and dark panel pattern. Added a separate soft elliptical ground shadow that stays on the floor during small ball lifts.
- Removed enclosing concrete bench walls using registered floor cutouts. Extracted bench-seats.png separately from bench-front.png; seat backs/cushions/supports now render before seated players. Raised and resized the seated bodies to align hips with the cushions.
- Background and scene cache versions updated. Visually confirmed in the local browser; no additional automated tests per user preference.
- Screenshot: arena-bench-ball-fixed.png. Main and hosted site untouched.

## Multiplayer V3 system import
- Source: origin/dev/multiplayer-v3 at 609ac47 (latest fetched source), rather than the older sibling v3 snapshot.
- Copied the complete V3 js game modules, RoomClient, RoomAdapter, phase-work, worker routing/Room Durable Object/game processing, room.css and build configuration.
- Preserved current arena art, characters, goalkeeper/ball/bench fixes and title presentation. Added the real data-room="open" multiplayer action to the title.
- Removed the old standalone screen classifier script: V3 classifies screens explicitly from the app render route.
- Asset build includes arena images. Existing V3 syntax guard allows presentation-only background observers while retaining Room/DOM boundary checks.
- Minimal verification: 32 JS files parsed, 24 module instances linked, asset build completed. No extra test suite or live multiplayer session run.
- Current Python static preview does not execute /api/rooms. Multiplayer requires the included Cloudflare Worker/Durable Object runtime (e.g. wrangler dev); no deployment or push was performed.
- Rollback point before import: ca24985. Target branch remains dev/living-clubhouse-ui.

## Bench shelter follow-up
- Added translucent curved dugout roofs and separate foreground supports to both benches.
- Seated reserves now render behind the existing chair textures; raised their seating alignment so heads and shoulders remain visible.
- Added spare footballs, water bottles, team-colored coolers and folded bibs with ground shadows.
- Confirmed the home screen visually in the local browser; no additional test suite run. Game and multiplayer logic unchanged.


## Home entry popups
- Wrapped club setup, load slots, multiplayer entry and room lobby in accessible, scrollable dialogs over the arena.
- Kept arena animation alive across popup navigation; retained existing game and room actions. Added close and Escape controls, inert background and keyboard focus containment.
- Visually confirmed setup, load and multiplayer entry plus close/reopen in browser. Live lobby requires the Room API, unavailable on this static preview; its shared dialog integration is implemented but live entry was not verified. No extra test suite run.
## Draft ceremony background

- Generated assets/arena/draft-hall.webp using the built-in imagegen tool; empty arena architecture without emblems or people.
- Added js/draft-hall.js with independent pixel spectators and slow spotlight movement, using existing character art. Motion stops with reduced-motion or hidden pages and is disposed on leaving draft.
- Six desk panels and visible club labels use actual league club colors and names. No invented team emblems.
- Added responsive stage space above readable navy player cards. Browser confirmed draft entry and visual layout; no extra test suite run. Screenshot: docs/draft-hall.png.

Generation prompt: Generate a polished 16:9 game background for FOOTBALL LEAGUE draft ceremony. Symmetrical indoor futsal arena converted to dramatic draft stage, deep navy architecture, blue and emerald accent lighting, overhead steel trusses, huge suspended circular LED ring near top, big rectangular LED video screen center, tall vertical banners either side, central podium and stairs, six neutral navy team desks three left three right at lower middle, dark foreground press desks. Refined detailed 3D/pixel-art compatible game illustration. Camera centered facing stage, wide composition. NO people, NO spectators (empty dark tiered seats at sides for runtime pixel crowds), NO logos, NO team emblems, NO text, NO spotlight beams (runtime effects added later). All screens blank dark navy. Team desk front panels plain dark navy, no colored crests. Subtle floor reflections, not mirror glossy. Strong depth, richly detailed architecture. This is a production background asset, not UI mockup. Output landscape 1536x864 or equivalent 16:9.

## Compact draft layout
- Removed the ceremony header and club badges above the draft controls, restoring the previous full-width card layout while retaining animated hall art and club-color desks.
- Removed hall-specific width, padding and margin overrides; prevented scrollbar-width horizontal overflow. Browser visual check completed; no test suite run.

