# Modular motion assets

Normal player and goalkeeper animation base sheets contain no hair or expression. Registered eyes/brows and existing hairstyles are composited as separate layers; game playback never erases a source head. Rare character art remains on its dedicated renderer.

All quarter-view base heads use the original 592×560 template alpha and the existing HEAD_BOXES registration. The baked bald layer keeps every original alpha value, verified in the asset check. Joy uses the existing front head from player-parts-v1.png and preserves original pose offsets; raised arms are a separate foreground sheet.

The source image editing prompt used the built-in image generator: remove only hair and eyes/eyebrows/mouth from every sprite, preserve body poses, costumes, grid, head chin/ears/position and transparent background. Generated sheets were then registered once at asset build time to the existing head template. Head editing prompt: remove only the two eyes, preserving the head silhouette. Original source sheets are retained.

Entry points: motion-preview.html, season-finale.js, game-experience.js. The preview has a base-only checkbox for examining the layered assets. Verified all motion frames, all 20 hairstyles on the seven motion types, and unchanged original quarter-head alpha. Browser navigation was blocked by this execution environment.
