# Modular player appearances v3

Twenty hair identities, each with front and diagonal-right raster parts. Combine with the existing three faces, three skin tones, and black-framed glasses on/off. Hair remains brown. Field shirts and socks use the club's primary color; white details retain their shading. Goalkeepers keep the approved gray kit and white gloves regardless of club color.

## Assets and rendering

- `player-hair-v3.webp`: forty isolated generated hair parts in registered cells, lossless WebP.
- `player-head-quarter-v3.webp`: common diagonal-right bald head, lossless WebP.
- `avatars-preview-v3.png`: twenty assembled players for review.
- `preview.html`: hair gallery with skin/face/glasses/club-color/GK controls.
- `motion-preview.html`: approved idle/run/dribble/shoot/catch/dive bodies with the selected appearance layered onto their registered head positions.

`avatar-profile.js` normalizes version-3 profiles. Deterministic ID-based generation adds variety without consuming the game RNG. Old saves are expanded on display without modifying saved roster data. Explicit version-3 profiles retain their appearance on subsequent renders and transfers. UI image caches include appearance, club color and goalkeeper role; motion frame caching has a global upper limit.

Pass `appearance`, `kit` and optional `goalkeeper` to `drawMotion`. Existing callers that omit appearance retain the original approved drawings. Catch and dive always keep their gray kit. Opposite-view right-foot shooting still requires a dedicated view; the preview preserves the existing right-facing kick.

## Image generation prompt set

Generated with the built-in image-generation tool. References: `player-parts-v1.png` (front hair and body style) and `player-run-v3.png` (approved diagonal-right character).

Shared specification: Hair only, no face/skin/eyes/body; crisp shaded warm-brown pixel art, dark outlines, consistent skull size, transparent background. Four columns and two rows per sheet: front views above, matching diagonal-right views below. Isolate every sprite with padding. Keep the fringe above the eye area; no labels or watermark.

1. Short / side part / spiky / crew cut.
2. Buzz cut / mohawk / center part / curly.
3. French crop / quiff / slick back / pompadour.
4. Bob / wavy / afro / cornrows.
5. Ponytail / top knot / undercut / long.

Short-hair correction prompt: Three columns and two rows. Distinct crew cut with very short bristly flat top and no long fringe; almost-shaven smooth buzz cap with uniform small texture and no bangs; French crop with a straight blunt horizontal fringe. Preserve the brown palette, pixel shading, transparent face opening and front/diagonal-right pairing.

Quarter-head prompt: Head only matching the reference, remove brown hair and complete the bald skull, keep small vertical black eyes and narrow rounded face, visible left ear, no mouth/nose/body, transparent background. Source bodies and motion timing remain unchanged; registration and palette changes happen in the renderer.
