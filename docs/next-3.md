# Handoff 3: the hero figure's next pass

> **Status.** §2.1–§2.3 are live on `main`; §2.4–§2.6 are still to do. Where the build departed from this brief:
> - §2.2: Gear Two takes the light map too, since red reads as a lit statue that way and as a red negative the other.
>   Only the lights' switch swaps the maps behind a band; Gear Two's switch swaps them at once, under its flash and
>   glitch, and reduced motion swaps them in one still. While the other map is on its way the figure is drawn at 60%,
>   and the opening fetches the light map once its shine has crossed, because it always visits Gear Two. The still and
>   the preview have dark versions; the home page's boot script preloads the one for the paper it opens on.
> - §2.3: the flow around the body is per dot, not a field. A blown dot slides along its row to the figure's edge
>   (`edgeDistances`) and leaves along the outline there, the wind with its component into the outline taken out
>   (`edgeNormals`, two bytes in a 36-byte vertex, `a_w`), then turns into the wind; its turbulence is a waver shared
>   with its row, which keeps the streams coherent, rather than curl noise. No texture or transform feedback: still one
>   program, one buffer, one VAO. The paper glow is as it was; the owner approved the gust as filmed.

You are taking over the hero figure of Aakash Dahal's portfolio: the winged statue (his GitHub avatar) drawn as a
turning WebGL sculpture of dots at the top of the home page. Repo `skysssup/skysssup.github.io`, live at
https://skysssup.github.io (GitHub Pages, deployed from `main` about 30 seconds after a push). You have push access to
the repo. This document is your whole brief: what exists, what the owner wants now, how the engine works, the traps,
and how to deliver.

## 0. Scope, access, and how to work

- **Scope: only the hero figure.** That is `#figure` on the home page: `js/hero.js` (the engine), its data pipeline
  `tools/hero/build.py` and `assets/hero/*`, its rules and colour tokens in `css/site.css`, its wiring in `js/page.js`
  (the mount and the opening) and `js/motion.js` (`switchGear`), its tests, and its docs. Do not redesign or restyle
  anything else on the site (plates, the contact dial, `/work`, case studies, header, footer). Touch other code only
  where a hero change forces it, and say so in the commit.
- **Commit straight to `main`. No pull requests.** This is the owner's standing preference. Make coherent commits,
  one per request below, each with a message that says what changed and why (match the existing history's style).
  Push when a step is green and checked by eye. CI (`.github/workflows/test.yml`: unit + e2e) must stay green on
  every push.
- **Who you are working for.** Aakash is 19; the site goes to Andreessen Horowitz program reviewers, so everything
  must read as serious, original, and senior-level. He writes fast and informally (typos, run-on sentences); read for
  intent, not wording. He judges by eye: report with a short video of the opening and 2× crops, not prose. He loved
  the last pass ("crazy upgrade"), so keep its character and build on it; do not throw it away.
- **Read, in this order, before touching anything:** this document; `README.md` (the `js/hero.js` paragraph);
  `docs/design-spec.md` §5 (palette), §7 (hero engine: Points, Sheen, Bits and crystals, Stronger on light and dark
  paper, Opening), §8 (motion), §9 (Gear Two), §14 (tests); `js/hero.js` end to end (1,414 lines; it is the whole
  engine); `tools/hero/build.py`; `test/hero.test.cjs`; `test/e2e/hero-resilience.test.mjs`; the traps in §4.
  `docs/next.md` and `docs/next-2.md` are the earlier handoffs, for history.
- **The source image** is `tools/hero/avatar-424.jpg`, the 424 × 424 px GitHub avatar (the owner re-sent exactly this
  file as the reference for this pass). Everything downstream is limited by it: the face is about 40 px wide in it and
  each hand about 30 px. `assets/avatar.jpg` is a 4× upscale (Real-ESRGAN blended with Real-ESRNet) and
  `tools/hero/depth.png` a cached 16-bit depth map (Depth Anything V2 Base). Use the JPEG as the ground truth for
  every comparison in this pass, side by side, at the same scale.

## 1. Where things stand (commit `c5fdf8b`)

The last pass shipped four things. Know them well; every request below builds on them.

**The opening.** When the home page is opened in a tab, and again on every reload, the figure plays an opening
instead of assembling from a scattered shell. It never plays under reduced motion, and never when you come back to
the page from another page in the same tab (`sessionStorage` key `sky-intro`; `js/page.js` decides and passes
`intro: true` and `onIntro` to `SkyHero.mount`). The stages are written on `#figure` as `data-intro`:

| Stage | What happens | Timing (`INTRO` in `js/hero.js`) |
|---|---|---|
| `hold` | The figure stands still, facing the viewer, in its ink alone (`u_tint` 0, yaw and pitch 0, no blinking). The preloaded still (`assets/hero/preview.webp`) fades into this first drawn frame in place | `hold: 0.9` s, counted from the moment the drawn figure is on screen (`is-live`), not from the first draw |
| `shine` | A slower shine crosses it right to left and the materials' colours appear only behind the band (`u_flow.w` = 1, the `wake` term in the shader), with light on the paper behind it | `sweep: 1.4` s |
| `turn` | The ring fades in; the sway clock runs fast until the figure has turned once and is back in the middle (clock = `SWAY / 2` = 7); the turn's own sheen fires at its far side | `rate: 2.5` |
| `red`, `redshine` | `onIntro("red")` → `skyGear.switchGear(true, figure, true)`: Gear Two comes on with the shockwave leaving the figure, and is not saved to the session. 0.55 s after the palette turns, a red shine crosses left to right | `red: 0.55`, `wait: 2` (gives up if the page never switches) |
| `redturn`, `back`, `done` | The red figure turns once the other way (its sheen at the far side) until clock = `SWAY` = 14, then `onIntro("back")` switches Gear Two off and the figure idles as before | `redRate: 3.2` |

About 10 s in all. `introStep(state, now, clock, gear)` is the pure state machine (exported, unit-tested). Any
`pointerdown`, `keydown`, or `wheel` ends the opening at once (`hero.skipIntro(keepGear)`): colours and ring arrive,
and Gear Two goes back off unless the press was on Gear Two or the lights, which then act on the page as it is.
Scrolling the figure away, hiding the tab, reducing motion, or losing the WebGL context ends it too.

**The shine, on every sheen** (each turn of the sway, every 7 s or 4.4 s in Gear Two; once as the dots assemble;
and the opening's explicit shines). The CPU only sets uniforms; everything per dot is in the vertex shader:

- A band of light, a Gaussian across the screen weighted by how much the rotated normal faces the viewer, 5% of the
  figure's box wide on light and dark paper (3.5% in Gear Two), with an afterglow in its wake. It moves dots toward
  `--figure-sheen` → `--figure-sheen-core` and enlarges them by up to 65%.
- A burst of four-point stars on the lit side: 64 on light and dark paper (`STARS_BRIGHT`), 40 in Gear Two.
- **Bits and crystals** (the last pass's reading of "the flow of materials"): 1.4% of dots (`BITS`) leave the
  surface when the band passes them, travel in the sweep's direction at 40–85% of the figure's width per second,
  rising a little, drawn as a bright head with a short tail. Where a bit reaches the figure's edge along its row
  (per-dot distances in `a_e.xy`, from `edgeDistances` on the depth map's mask) it becomes an eight-point crystal
  (white heart, tips in the sheen colour) for 0.55 s, then the dot re-forms at home. A sheen lasts its sweep plus
  `SHEEN_AFTER` = 2.3 s.
- The paper takes the light: `.hero-glow`, a soft ellipse in `--figure-glow`, follows the band (moved by a transform,
  so no layout), on light and dark paper only.
- Uniforms: `u_sheen` (eased progress, direction, burst number, age), `u_span` (figure left and right in px, band
  width, star chance), `u_flow` (bit share, sweep length, 1 for the stronger light/dark shine, wake), `u_light[3]`
  (fringe, core, star colours).

**Face and hands.** On screens of 1.5 device pixels per CSS pixel or more, three soft ellipses (`fine` in
`assets/hero/hero.json`, `FINE` in `build.py`: the head, the fist on the caduceus, the open hand) are stippled on a
grid twice as fine with dots 62% the size (`fineWeight`, `fineCell`, the `zones` argument of `stipple`), and the ink
map is sharpened inside them (unsharp mask 1.5 px, 0.8). Below 1.5 the grid is unchanged, because finer dots there
are smaller than a pixel and only darken the stone. The still and preview are drawn at the engine's framing and
foreshortening (`fit()` plus perspective), so one fades into the other without a jump.

**CI health.** `main` had been red: the plates' stipple drawings (added in the commit before) rasterised tens of
thousands of arcs on GPU-backed canvases at load, which queued ahead of the hero's shader compile and held its first
frame back by about 8 s under SwiftShader. They are now drawn in software (`willReadFrequently`), the assembly's
sweep follows the wall clock like the assembly (the sway clock is capped at 50 ms a frame and runs slow where frames
do), and a plate's screenshot hides at once instead of fading out at load.

**Numbers today.** 93,201 dots at 1440 × 900 (127,340 on a 2× screen), 35,216 at 390 wide on a 2× phone. JS takes
0.1–1.1 ms a frame under SwiftShader (the readout under the figure; the budget is 2 ms). Hero data 166,605 bytes against the 200 KB test budget
(`ink.webp` 88 KB, `depth.webp` 47 KB, `color.webp` 27 KB); `preview.webp` 79 KB, `still.webp` 251 KB. Tests: 68
unit (`npm test`), 54 browser (`npm run test:e2e`), all green locally and in CI (run 37246616538).

## 2. The owner's brief for this pass

His words, lightly cleaned up (the meaning is unchanged):

> Only the hero figure; I really liked the last pass. 1. Make the first pause two seconds instead of about one.
> 2. Make the blue wave much stronger and really good looking. It looks good now, but I want more, with a flow around
> the body. You didn't get what I meant: I meant something like a flow of wind that pushes the dots in the wind's
> direction, and the dots disappear toward the edge; when a dot is about to disappear it should shine like a bright
> dot. 3. The white sparkle from the image is missing. I want it, increased to much higher levels; by sparkle I mean
> white, like stars, good looking. Just like the JPEG has sparkle stars, it should be like that; the windblown shine
> the image has is missing. 4. The hair doesn't match. Perfection is needed head to toe: the hand detail, the navel,
> and the chest and stomach clarity need work, done a different way, to look more appealing. 5. When it moves down
> the 3D model looks incomplete, which makes it feel unfinished. This only happens with the black theme: on black,
> white and black are swapped, and that spoils the look, so the black theme needs its own adjustment.

What follows is my reading of each point (I built the last pass and watched his reactions), what exists, what to
build, and how to know it is done. Do them in this order; push after each.

### 2.1 Hold the still figure for 2 s (do this first, it is one constant)

`INTRO.hold` 0.9 → 2.0 in `js/hero.js`. The unit test reads the constant, and the e2e opening test only needs its
15 s wait to still cover hold + shine + the start of the turn (it does). Update the timing table in
`docs/design-spec.md` §7 (Opening) and the README sentence. The still preview already shows before the first frame,
so the visitor sees at least 2 s of the still, black figure. Push this on its own so he sees progress immediately.

### 2.2 Dark paper: stop drawing a negative (the most important visual fix)

**What is wrong, precisely.** The stipple's density is ink: `ink.webp` is dense where the statue is dark (shadow,
crevices, eye sockets) and sparse where the marble is lit, which is right on white paper, where dots are black. On
dark paper the dots are warm white (`--figure-ink: #ecebe8`), so the same density draws a photographic negative:
the shadow under the raised arm, the fist, and the gaps between the abdominal muscles become bright masses of white
dots, and the lit chest and shoulder go dark. Put the dark-mode figure beside the JPEG and it reads like an X-ray.
That is the "white and black are swapped" he describes, and it is also why the figure looks unfinished on black: the
silhouette's rim and the cloud bank glow where they should fall away into the dark, so the hollow edges of the
relief (§2.6) jump out.

**What to build.** On dark paper the dots should stand for light, not ink: a positive engraving, like a lit statue
in a dark room (the JPEG itself is exactly that). Suggested route:

1. In `build.py`, derive a light map at 896 px beside the ink map: density from the source's luminance (lit marble
   dense, shadow sparse), the depth surface lit from the upper left, specular highlights and the image's own bright
   rims kept, and the same feature emphasis the ink map has (local contrast, the sharpening in the fine zones), so
   the eye socket, the nostrils, the open mouth, the fingers, and the abdominal grooves read as darker gaps between
   lit forms. Tune it against the JPEG, not against the ink map inverted (an inverted ink map is not a light map: it
   loses the contour weighting and blows out the flat lit areas).
2. In the engine, stipple the light map when `colors.dark` (and in Gear Two, whose paper is also dark: decide by eye
   whether red reads better as light or as ink; I expect light). Rebuild the geometry on a theme change. The current
   theme change only cross-fades the ink colour over 320 ms; with a different dot set you need a transition. The
   design language already has one: let a sheen sweep across and swap the dots behind its band (the opening's `wake`
   mechanism does exactly this for colour).
3. Budget: a second 896 px map adds roughly 80–90 KB and breaks the 200 KB hero-data test. Prefer loading the light
   map only on dark paper (and when the lights go off), so light mode's first paint is unchanged, and change the
   test to a per-mode budget with a comment saying why. Do not raise a budget silently.
4. Check the materials' dark palette (§5 of the spec) against the new positive figure; gold, rose, cyan, and glint
   were tuned on the negative.

**Done when** the dark-mode figure, side by side with the JPEG at the same size, reads as the same lit statue (lit
side bright, shadow side dark), at 1440 and 390, DPR 1 and 2, in the still, the opening, and Gear Two.

### 2.3 The blue wave becomes wind

**What I built and why he says I missed it.** Today the band brightens the dots it crosses and 1.4% of them slide
off in straight horizontal streaks to their row's edge, crystallise, and re-form. He wants a much bigger, more
physical effect: a gust of wind that sweeps over and around the body. Read his words as these requirements:

- **Much more of the surface moves.** As the wave passes, a large share of the dots (think 10–30% near the band,
  not 1.4%) are pushed downwind together, like dust or sand blown off a statue, with coherent streaming motion, not
  isolated dashes.
- **The wind flows around the body.** Paths are not straight lines: they follow a flow field that bends around the
  silhouette (streamlines that hug the arm, the wing, the head) with gentle turbulence (curl noise), so the motion
  reads as air flowing past a solid. A per-dot flow direction from the silhouette's distance field (tangent along the
  outline, blended with the wind direction) can be computed at load like `edgeDistances`, and stored in the spare
  byte of `a_e` or a widened vertex.
- **Dots disappear toward the edge, and flare before they go.** Dots near the downwind edges are blown off the
  figure; just before each vanishes it brightens into a bright point (a short flare with a soft halo: white-hot on
  dark paper; on white paper a bright core with a sheen-coloured halo, since white does not show on white), then
  fades. Dots further inside sway and return, like grass after a gust. The figure must look whole again after the
  wave.
- **The wave itself is much stronger and beautiful.** A luminous leading edge, more light on the paper, the colour
  of the light carried by the moving dots. On light and dark paper only, as now ("the blue wave"); Gear Two can share
  the flow in its own warm colours if it looks right, but do not make Gear Two louder than it is.

**Approach notes.** Everything is stateless in the vertex shader today (a dot's position is a closed-form function
of time). Wind can stay stateless: integrate a smooth, time-independent flow field along a short analytic path, or
evaluate it at a few points along the path (start, middle) and accumulate. If you need real particle state
(transform feedback), that means a second buffer, and the resilience tests count exactly one program, one buffer,
and one VAO per context restoration (§4): change that contract only deliberately, with the tests and the spec updated
in the same commit, and keep geometry deterministic. Mind the cost: CI renders with SwiftShader on CPU.

**Show him a 5–10 s clip of the wind before you polish it.** He said outright that I misread this once; confirm the
direction early.

**Done when** a clip of the opening shine reads, at a glance, as wind blowing glowing dust across and around the
figure, the dots flaring to bright points as they leave the edges and the figure re-forming, on light and dark paper,
and the existing sheen tests still hold (`u_sheen` crosses 0→1 within 8 s of load; nothing under reduced motion).

### 2.4 White star sparkles, like the JPEG

**What is missing.** The JPEG is full of white star glints: on both wings, along the caduceus, across the gold
rubble at the base, around the lightning, and as stars in the sky. Our figure keeps only a faint trace: the colour
map's alpha carries the image's sparkle highlights, and the shader makes those dots swell and shift toward a warm
colour (`tw` and `u_hot` in the vertex shader). There are no star shapes outside the sheen's burst, and the burst is
blue. He wants white stars, many of them, and good looking.

**What to build.** Detect the point highlights in the source (local luminance maxima that are small and much brighter
than their surroundings; expect a few hundred inside the figure and some just outside it) in `build.py` and ship them
as data (a list in `hero.json` or a channel of an existing map). Draw each as a star: a bright heart, four long arms
and four short diagonal ones (the crystal shape in the fragment shader is a starting point), sizes varied like the
JPEG's, each twinkling on its own slow rhythm all the time, brighter and more numerous while a shine passes. On dark
paper they are white with a soft glow. On white paper pure white is invisible: give them a thin edge or halo (a pale
gold or the sheen's blue) so they still read as white stars; judge by eye. Consider a sparse field of stars just
outside the silhouette, as in the JPEG's sky, if it does not compete with the ring.

**Done when** the figure, next to the JPEG, carries its sparkle: you can point at the glints on the wings and the
base in both and they match in place and feeling.

### 2.5 Head to toe: hair, hands, navel, chest and stomach

**Hair.** In the JPEG the hair is a crown of golden, back-lit curls. In ours it is patchy: the material map paints
gold only where a pixel inside a rough ellipse is warm enough (`hair = zone((205, 187, 34, 25)) & ~face` and
`paint(hair & (b > 6), 'gold', warm)` in `material_map()`), so some curls are gold and some are marble ink, and the
zone does not follow the hairline. Draw a proper hair mask (a polygon following the curls in the 424 px source's
coordinates, like the other zones), give the hair one consistent material and colour that matches the JPEG in each
mode, and make the curls read as curls (they are inside the head's fine zone; check the sharpening there).

**Hands, navel, chest, and stomach ("a different way").** More dots will not help: the source is 424 px, and the
fine grid already shows what the ink map holds. Detail now has to come from better shading cues and a better drawing
technique. Options, roughly in order of value:

1. A cavity term: darken (in ink) or drop (in light) dots in concavities: the navel, the grooves between the
   abdominal muscles, under the pectorals, between the fingers. Derive it from the depth's Laplacian or, better, from
   a proper normal map.
2. A better surface: run a dedicated monocular normal estimator (for example Marigold normals, StableNormal, or DSINE)
   or a stronger depth model (Depth Anything V2 Large, Depth Pro) on the 1696 px upscale, cache the result in
   `tools/hero/` like `depth.png`, and drive both the lighting and the cavity term from it. Check that it does not
   invent anatomy: compare with the JPEG.
3. Engraving lines instead of noise on the torso: place the stipple along the form's contours (iso-lines of tone,
   or the principal curvature directions), so the chest and stomach read as hatched like a banknote portrait. This is
   the "different way" most likely to look striking; prototype it on the torso before committing to it.
4. A torso fine zone (chest, abdomen, navel) like the face and hands, once the map has the detail to fill it.

**Done when** 2× crops of the face, both hands, the chest, and the navel, beside the same crops of the JPEG, show the
same features with clearly more definition than today, in light and dark (`tools/qa` crops; see §5).

### 2.6 The 3D figure must look whole when it moves

**What he sees.** The figure is a relief: each dot's depth comes from a monocular depth map (scaled to 0.34 of the
width), with no back and no sides, and the cloud bank fades out at the bottom. When it tilts (the sway pitches it
±4°, the cursor over the figure adds up to ±8.6°, the turns reach ±16° of yaw, faster in the opening) the rim
thins and spreads and the cut-off base shows. On black paper, drawn as a negative, those edges glow, so the hollow
shell is obvious; that is "when it moves down it looks incomplete, only on black". Reproduce it first: dark mode,
cursor over the lower half of the figure, through a full turn, and while scrolling the page.

**What to build.** The light map (§2.2) removes most of it. Then: give the silhouette thickness (a short wall of dots
extruded behind the outline, placed in the shader from the edge distances you already have, so a turn shows a side
instead of a gap); fade the base and the cloud bank into the paper over a longer, softer gradient; and if needed limit
pitch and yaw so the relief never shows its back. Check at the extremes of the opening's fast turns too.

**Done when** frames at the extremes of the sway, the cursor tilt, and the opening's turns look like a solid object in
all three modes.

## 3. How the engine works (a map, not a substitute for reading the code)

- **Data, offline** (`python3 tools/hero/build.py`, numpy and Pillow; `--depth` and `--upscale` need torch):
  `ink.webp` 896 px lossless grey (where the dots go), `depth.webp` 448 px (R depth, 0 outside the figure; G detail),
  `color.webp` 448 px RGBA (R material index × 51: gold, marble, cloud, lightning, glint; G its weight; A 128 + the
  image's sparkle), `bluenoise.png` 64 px, `hero.json` (sizes, bounds, centre, density, ring, `fine` zones),
  `still.webp` and `preview.webp` (masks of the same stipple, at the engine's framing). After changing the still,
  run `npm run og` (the share images embed it; a content test checks they are current).
- **Load** (`mount()` → `initialize()` → `size()`): stipple the ink map against the blue-noise tile at 1.4 cells per
  CSS pixel of the figure's width (fine zones split on 2× screens); per dot sample depth, normal (`depthNormals` on
  the smoothed relief), detail, material, sparkle, edge distances; pack a 32-byte vertex: `a_p` (x, y, depth, ink),
  `a_n` (normal xy), `a_c` (material, weight, detail, sparkle bytes), `a_e` (edge right, edge left, fine flag, one
  spare byte). One buffer, one VAO, one program, one `drawArrays(POINTS)` (two more faint draws during Gear Two's
  glitch for the afterimages).
- **Each frame** (`render()`): springs for yaw and pitch toward the sway (±16° over 14 s, 1.6× in Gear Two) plus the
  cursor; `introStep` when the opening plays; `sheenPhase(clock)` for the sheens; Gear Two's heartbeat and tears
  (`tearSchedule`); uniforms; the ring of text on a 2D overlay canvas (`drawRing`); the `.hero-glow` element.
- **Vertex shader order:** assembly from a shell (`u_build`; 99 when the opening plays) → rotation of point and normal
  → lighting (Lambert from the upper left, rim) → cursor push and click ripples → Gear Two slices and tiles → material
  colour from `u_palette`/`u_lit` → the sheen block (band, afterglow, wake, stars, bits, crystals) → blink → size and
  alpha. The fragment shader draws discs, star crosses, bit streaks, and crystals.
- **Colours** are CSS custom properties per mode in `css/site.css` (`--figure-ink`, `--figure-sheen`,
  `--figure-sheen-core`, `--figure-star`, `--figure-glow`, `--mat-*` and `--mat-*-lit`), read by `readColors()`.
  Keep colour decisions in CSS.
- **Page wiring:** `js/page.js` mounts the hero, decides the opening, installs the interrupt listeners, and maps
  `onIntro("red" | "back")` to `skyGear.switchGear(on, figure, true)`; `js/motion.js` owns Gear Two
  (`switchGear(on, origin, transient)` never saves a transient switch to the session).

## 4. Traps (all found the hard way)

- **One program, one buffer, one VAO.** `test/e2e/hero-resilience.test.mjs` counts them per context restoration and
  compares the buffer upload's bytes and hash across restorations: geometry must be deterministic (seeded hashes
  only, no `Math.random`).
- **Reduced motion draws exactly one still, and two stills must hash identically.** Nothing time-based may leak into
  that frame; every new uniform must be constant there.
- **Uniform names are a test contract.** The probe records `u_rot`, `u_time`, `u_blink`, `u_beat`, `u_glitch`,
  `u_pointer`, `u_rip`, `u_build`, `u_tint`, `u_sheen`, `u_span`, `u_flow` (and series of `u_sheen`, `u_glitch`,
  `u_tint`, `u_flow`). Keep their meanings; add new ones freely.
- **The e2e suites opt out of the opening** by setting `sessionStorage['sky-intro'] = 'seen'` in their init scripts;
  only the three opening tests play it. A reload replays it (one site test reloads the home page; harmless).
- **SwiftShader.** CI and Capy machines render WebGL on the CPU. Shader compiles take seconds; any GPU work queued at
  load (accelerated canvases, big uploads) delays the hero's first frame. The test "a band of light crosses the
  figure soon after it assembles" requires the first sweep to finish within 8 s of navigation; it is the canary.
  Keep the plates' canvases in software. Real-time recordings run at a few frames a second, so judge motion with the
  film mode (§5), not with a screen recording.
- **The sway clock is capped at 50 ms a frame** and runs slow where frames are slow. Anything that must happen on
  time (the assembly's sweep, the opening's hold and shine) uses wall time. Sheen triggers fire on
  `turn.index > sheenIndex` (turns only move forward; `!==` once let a stale index replay a sweep mid-flight).
- **The still must match the first frame.** If you change framing, relief, or the ink, rebuild with `build.py` so
  `preview.webp` still lands exactly where the figure is drawn, or the opening's hold shows a jump.
- **Hero-data budget:** a unit test caps `ink.webp + depth.webp + bluenoise.png + hero.json + color.webp` at 200 KB.
- **Canvas 2D premultiplies alpha** when the engine reads a map, so `color.webp` keeps alpha ≥ 128; save maps with
  Pillow's `exact=True` lossless WebP and no colour profile (a test checks VP8L).
- **The generator must reproduce every committed page byte for byte.** Run `node tools/pages/build.mjs` after any
  change to `tools/pages/site.json` (it holds the dot count printed under the figure: update it when the count at
  1440 × 900 changes) and commit the regenerated HTML.
- **`--beat-delay`.** Any new CSS pulse in Gear Two uses `animation-delay: var(--beat-delay, 0s)` and a 0.9 s period.
- **Do not log or print secrets.** On Capy machines, if `git push` fails with "Invalid username or token" after the
  machine has slept, the owner has to reconnect GitHub (Settings → Integrations → GitHub); ask him, do not work around
  it.

## 5. Commands and the QA protocol

```sh
npm ci && npx playwright install chrome      # once; on Capy: CHROME_PATH=/usr/local/bin/google-chrome
python3 -m venv ~/hero-venv && ~/hero-venv/bin/pip install numpy pillow   # outside the repo; torch only for --depth
~/hero-venv/bin/python tools/hero/build.py   # rebuild hero data; then npm run og if the still changed
node tools/pages/build.mjs                   # after site.json changes
npm test                                     # 68 unit and content tests, under a second
npm run test:e2e                             # 54 browser tests, ~12-17 min; run on a quiet machine (timing tests)
node --test --test-name-pattern="opening" test/e2e/hero-resilience.test.mjs   # one group
python3 -m http.server 8080                  # serve for tools/qa/shots.mjs
node tools/qa/shots.mjs shot / 1440 900 dark out.png        # light|dark|gear; DPR=2, CLIP=x,y,w,h
node tools/qa/shots.mjs film frames/ light 11 1440 900 25   # the opening under virtual time, one PNG per frame
ffmpeg -framerate 25 -i frames/f%04d.png -pix_fmt yuv420p opening.mp4
```

The film mode steps `performance.now`, `requestAnimationFrame`, and `setTimeout` by hand, so software rendering
cannot drop frames (CSS animations such as Gear Two's flash still run in real time). Use it for every motion change.

For every visual change: look at the figure in light, dark, and Gear Two, at 1440 × 900 and 390 × 844, at DPR 1 and
2; make 2× crops of the face, both hands, the chest, the navel, and the hair beside the same crops of the JPEG; film
the opening in light and dark; watch the ms/frame readout under the figure (budget: under 2 ms of JS a frame).

## 6. Definition of done

1. Each of §2.1–§2.6 is live on `main` as its own commit (or a short series), pushed directly, CI green after each.
2. New behaviour has tests: unit tests for new pure helpers (flow field, highlight detection, map choice per mode,
   anything exported), and probe-based e2e checks where behaviour is observable (for example, the dark-mode geometry
   comes from the light map; no wind or sparkle twinkle under reduced motion; the opening's hold lasts 2 s).
3. `README.md` (the `js/hero.js` paragraph) and `docs/design-spec.md` §5, §7, §8, §9, §14 describe the new state; mark
   this document done at the top, saying where the build departed from it and why.
4. The report to the owner leads with a video of the opening in light and dark and the 2× before/after crops beside
   the JPEG, then lists what changed, the measured numbers (dots, ms/frame, data sizes, first-frame time), and anything
   not done or not verified.

## 7. My opinions, from the previous pass

- Do §2.2 before the wind. It is the biggest quality jump for the least risk, and the wind and the sparkles are judged
  on dark paper as much as on light.
- The owner reacts to drama, but the audience is investors' reviewers: make it spectacular for ten seconds and then
  calm. Keep the opening under about 12 s, keep every press able to skip it, keep the idle sway quiet, and keep
  reduced motion a single still.
- The 424 px source is the ceiling for real detail. Anything that looks sharper than the JPEG must come from shading
  and drawing technique, never from invented features; check every crop against the JPEG.
- White on white paper does not exist. Every "white" effect (sparkles, flares, crystals) needs a deliberate light-paper
  treatment, decided by eye, not a colour swap.
- Prefer one shader with more terms over new programs and passes; if you must add a pass (bloom, transform feedback),
  update the resilience contract, the tests, and the spec together, and measure the first-frame time under SwiftShader.
