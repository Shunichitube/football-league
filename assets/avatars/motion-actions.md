# Shooting and goalkeeper actions

Generated with the built-in image generation tool, using `player-run-v3.png` as the visual reference. Four drawings per action; transparent background and no baked-in ball. The goalkeeper uses medium gray shirts/socks, charcoal shorts and white gloves.

- `player-shoot-v1.png`: right-foot wind-up, knee forward, strike, follow-through.
- `keeper-catch-v1.png`: ready, reach, cup hands, hold at chest.
- `keeper-dive-v1.png`: crouch, push off, airborne, side landing. The four connected sprites were extracted into padded 700px cells to prevent neighboring-frame clipping. The preview uses a wider view of the diving body.

Actions stop on the final drawing by default. `motionFrame` and `drawMotion` accept `loop: true` for explicit looping. The confirmation page repeats after a short hold, with separate frame stepping. Shooting remains right-facing even when the other motions are mirrored: mirroring would turn it into a left-foot kick. A dedicated opposite-view drawing is needed before adding right-foot shooting in both directions to the match renderer. This change adds assets and the confirmation page only; match event integration remains separate.

## Generation prompt set

Shared: Preserve the reference's brown spiky hair, narrow large head, small vertical black eyes, no mouth, compact body and crisp shaded pixel art. Exactly four full-body poses in a 2x2 grid, equal square cells, same scale, transparent background, no text or ball. Face diagonally screen right.

Shoot: Blue shirt with white V, white shorts, blue socks and white shoes. Anatomical right foot winds back, swings forward, extends to strike, then follows through. Left support foot stays planted; arms balance and head height stays consistent.

Catch: Goalkeeper long sleeves and white gloves. Ready crouch, both hands reach forwards, gloves cup at chest, then hold securely at chest.

Dive: Crouch, push off with gloves extending right, horizontal airborne dive, land on the right side with feet trailing left. Preserve anatomy and character proportions.

Final keeper color edit: Replace green shirts/socks with neutral medium gray, silver highlights and charcoal shadows; replace navy shorts with dark charcoal. Preserve brown hair, white gloves/shoes, all poses, identity and transparency. Keep all four full sprites inside their cells.
