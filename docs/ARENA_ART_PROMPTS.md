# Arena art production prompts

Built-in image_gen was used, with no API/CLI fallback. Two original generated assets were used; the actual game consumes four registered files, not a contact sheet.

## Architecture — opaque generated source
Use case: stylized-concept. Create one production game background asset, 16:9, 1920x1080 landscape. Premium illustrated indoor futsal arena, symmetrical elevated sideline camera looking across green futsal court, rich navy steel roof trusses and speakers, warm doorway lights, densely detailed EMPTY blue seats in two tiers across rear and sides. Suspended large blank black rectangular scoreboard centered at x 50%, y 12%, width 24%, height 14%. Architecture upper 49% of frame. Matte green court trapezoid corners (18%,53%),(82%,53%),(96%,83%),(4%,83%), white futsal markings, center ellipse and halfway line, restrained floor grain NO strong gloss. Small goal rear supports at left x12% y64% and right x88% y64%, no front mesh (added separately). Two open team bench REAR structures and seat backs along bottom left x12-36% and bottom right x64-88%, y84-90%, NO front rail or front roof struts (added separately). Empty narrow navy LED panels along rear court edge y49-52%. Camera like detailed Japanese sports management game title screen, dramatic cool blue ambient light, clear vivid green playing floor. ONLY fixed architecture. Absolutely NO spectators, people, players, balls, flags, confetti, light beams, foreground silhouettes, logos, text, UI, labels, inset panels or checkerboard. Seating front edges should have low solid fascia but no foreground metal railing, which is separate. Entire image is single coherent arena illustration with high detail. Match composition and atmosphere of user reference indoor arena but empty.

Actual generated output was 1672 × 941; this native size is the single coordinate basis throughout. The requested framing was interpreted by the generator, so final coordinates were measured from the actual output.

## Net — generated with transparent_background=true
Use case: stylized-concept. Production game foreground transparent PNG asset: ONLY a single flat rectangular futsal goal net mesh, front orthographic view, perfectly rectangular ratio width 1.1 to height 1.0. Fine white gray thin square knotted cords evenly spaced, subtle blue ambient lighting, realistic illustrated sports game style. Approximately 15 columns by 14 rows square grid. NO goal frame, NO posts, NO floor, NO background, no solid panel, no shadows outside cords. All holes between cords MUST be fully transparent alpha. Mesh fills central 90 percent of canvas. No text no checkerboard. This isolated net texture will be perspective warped onto both goals in game.

## Programmatic registration
Run from repository root with Python, Pillow and NumPy:

    python scripts/prepare-arena-assets.py assets/arena/source/architecture.png assets/arena/source/net.png

- Architecture fronts are exact source cutouts with real alpha; their source areas are removed from the base. Fine rail bars are rasterized at matching tier edges.
- Net texture is alpha-preserving projectively registered to left/right posts, then clipped to their exact quadrilaterals.
- All four output files share 1672 × 941 dimensions. Canvas draws each at (0,0) before applying one viewport transform.
- Scoreboard rectangle: x659–1013, y32–153; rear LED x315–1355, y472–490.
- Bench fronts: x78–588 and x1084–1595, y846–874. Reserves feet at y855, behind fronts.
- Left front net quad: (113,497),(186,480),(186,542),(113,568). Right mirrored registration: (1486,480),(1559,497),(1559,568),(1486,542).
