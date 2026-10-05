# Handoff 4: make the hero figure feel real, keep its detail when it turns, and add a blue gear

> **Status.** Live on `main`: steps 1a (`a1db9e1`), 1b (`25cc650`), 1c (`52d0bcc`), 2 (`b842192`), 3 (`610f1fe`), 4
> (`3d2f8dc`, strokes along the feathers instead of a finer 1x grid, whose dots would flicker), and the page side of 7
> (Tide and the gear shift, `47aece4`, `77211e7`) and 8 (the embers, `021c47a`). Step 5's first cut is on the branch
> `shine-wip`, never looked at in a browser. The rest (5, 6, the engine side of 7 and 8, 9) is briefed in
> `docs/next-5.md`, which supersedes this document for the remaining work.

You are taking over the hero figure of Aakash Dahal's portfolio, https://skysssup.github.io: his GitHub avatar (a
winged statue of Hermes holding a caduceus, rising out of clouds into a starry sky) drawn as a turning WebGL
sculpture of about 100,000 dots at the top of the home page. You have the whole site's source code and push access.
You can work for many hours. This document is your complete brief: the owner's words, what each one means, the exact
order to work in, how the engine works, every trap found so far, how to test, and how to report. Read all of it
before you change anything, and come back to it whenever you are unsure what to do next.

The owner's one-line summary of this pass: **the figure must look and feel real, keep its detail when it moves, and
be visually stunning, in a calm, premium way.**

---

## 0. Ground rules

**Repository and access.**
- The site is `skysssup/skysssup.github.io` (public, GitHub Pages, deployed from `main` about 30 s after a push). If
  your workspace checked out a different repository (the owner's profile repo `skysssup/skysssup` is a common one),
  clone the site yourself: `git clone https://git.capy.ai/skysssup/skysssup.github.io.git`.
- **Commit straight to `main`. No pull requests.** This is the owner's standing preference. One coherent commit per
  step (or a short series), each with a message in the existing history's style: a plain sentence for the subject
  that says what the visitor now sees, and a body that says what changed, why, and what you measured. Read
  `git log -15` before your first commit and match it.
- **CI must be green after every push** (`.github/workflows/test.yml`, workflow "Site tests": unit + e2e). Check with
  `gh run list -R skysssup/skysssup.github.io -L 3`. A red CI is your top priority until it is green again.
- If `git push` fails with "Invalid username or token" after the machine slept, the owner must reconnect GitHub in
  Capy (Settings → Integrations → GitHub). Ask him; do not work around it. Never print or commit a secret.

**Scope.** The hero figure (`#figure` on the home page) and, because the owner asked for them in this pass:
1. the Gear control in the header (it must read as a gear shift, and gain a blue gear, §3 step 7),
2. the new blue mode's palette across the site, done the same way Gear Two's red palette is (CSS custom properties
   on `:root[data-gear=…]`, nothing restyled by hand),
3. the cursor effect in Gear Two (the crosshair with x/y readouts goes, something beautiful replaces it, §3 steps 1
   and 8).

Do not redesign anything else: the plates, the contact dial, `/work`, the case studies, the header layout, the footer,
the copy. Touch other code only where one of the items above forces it, and say so in the commit.

**Who you work for.** Aakash is 19. The site goes to Andreessen Horowitz program reviewers, so everything must read
as serious, original, and senior-level: stunning, but calm and controlled, never gimmicky. He writes by voice, fast
and informal (his words below are a transcript); read for intent. He judges only by eye: report with a short video
first, then a few lines. He often changes direction once he sees a result, so for the big visual changes (the shine,
the blue mode, the gear control) send him a 5–10 s clip as soon as a first version runs, before you polish it.

**How to work.** Follow §3 in order. Each step says what he said, what it means, what to build, where in the code,
the traps, and when it is done. Push each step when it is green and checked by eye. When a step is ambiguous, take
the reading given here, build it, and show him a clip; do not stop and wait for an answer.

---

## 1. The owner's words for this pass

His voice transcript, lightly cleaned up (the meaning is unchanged):

> Details can be vastly improved; there is still room for improvement, massive improvement is needed.
>
> The dots are not flowing whatsoever. The dots are not supposed to stay like that; they are supposed to move. The
> avatar should look and feel real; it's only moving a very little. I need something that adds realism, like the red
> version.
>
> I need a blue-pill animation gear that changes everything to blue. No lightning. Some crazy animation in blue, like
> the yellow shine going through, that looks visually stunning. This feature should only be reachable manually.
>
> When the red mode is on, the button doesn't show it as a gear; it just turns red.
>
> The mouse cursor showing an x axis and a y axis is unnecessary and doesn't add value. Remove that for red, and add
> something stunning that is perfect in this context.
>
> The massive cloud beside the body should only be visible for the red avatar, for now.
>
> The shiny stars are completely removed. Bring them back like in the original image we used as the reference, in
> the places where they add visual beauty and feel, not too bright and not too big.
>
> The wings can be massively more detailed, and the sword (the caduceus) too. When it moves the details get lost:
> some parts move and some parts don't, and it creates distortion.
>
> There is no defined boundary to the body, which makes the edges look rough. That is degrading the beauty. I want a
> distinct, very clear edge so that it looks beautiful.
>
> The details getting lost as it rotates is the biggest downside at the moment.
>
> One addition: the shine that comes through should come from one side, and have much more depth to it. The shine
> should look surreal. For every background, and for the blue and red modes, the shine should have a different colour,
> chosen by your judgement of what will look perfect. The current shine is like a white ripple with no wow factor.
>
> Make it a complete, super detailed, step by step plan, and give everything to the agent so it doesn't misunderstand
> or lose direction.

What he liked and did not mention changing: the opening (the figure holding still in ink, the colours arriving, the
turn, the automatic switch to red with one lightning bolt, the return), Gear Two's red figure and its life, the
calmer dust, no lightning by hand, the ring of words with its gold light. Keep all of that.

---

## 2. Where things stand (the code as of `f4aaa83`, 5 October 2026)

Read `README.md` (the `js/hero.js` paragraph), `docs/design-spec.md` §5 (palette), §7 (hero engine), §8 (motion),
§9 (Gear Two), §14 (tests), `docs/next-3.md` (the last handoff and its status note), then `js/hero.js` end to end
(about 2,000 lines; it is the whole engine), `tools/hero/build.py`, `test/hero.test.cjs`, and
`test/e2e/hero-resilience.test.mjs`. What follows is a map, not a substitute.

### 2.1 What the visitor sees

- **Opening** (first visit in a tab, and every reload; never under reduced motion; `sessionStorage['sky-intro']`):
  the drawn figure holds still for 2 s in plain ink (the preloaded still fades into it in place); a slower shine
  brings the materials' colours in behind it; the figure turns once fast; the page switches to Gear Two (red) with
  the shockwave leaving the figure and **one lightning bolt** striking it (the only lightning anywhere); a red shine;
  one more turn; back to the normal page. About 10.5 s. Any press, key, or wheel ends it. The stages are written on
  `#figure` as `data-intro` (`hold`, `shine`, `turn`, `red`, `redshine`, `redturn`, `back`, `done`); `introStep()` is
  the pure state machine; `INTRO` holds its timing.
- **Idle**: the figure sways ±16° of yaw over 14 s (a "sway clock" that is capped at 50 ms per frame, so it runs slow
  where frames are slow) and ±4° of pitch. At each turn of the sway (every 7 s; 4.4 s in Gear Two) a **sheen** runs:
  today a ring-shaped wave of light that runs **out of the chest** (`core` in `hero.json`) to the figure's farthest
  reach, coloured from the paper (warm gold on white, ivory on dark, coral in red), with a few small twinkling stars
  and a gust that lifts fine dust off a few dots near the outline, which drifts out and fades into the paper. **The
  owner now calls this "a white ripple with no wow factor"; §3 step 5 replaces it.**
- **Between gusts**: a breeze takes a few dots off the outline (barely visible), and dots drift and fade instead of
  blinking (`fadeAway`, about 1.5% of the light away at any moment). **He says the dots "are not flowing whatsoever";
  §3 step 6.**
- **Cursor**: stirs the dots in an eddy around it; a quick sweep leaves puffs of fine dust. A touch drag turns the
  figure. Clicks and taps do nothing (no lightning by hand; the caption has no button).
- **Glints**: the avatar's own sparkles (found at load in the colour map's alpha: round local peaks on the wings, the
  caduceus, the rubble, the lightning, the clouds; never on marble, in the hair, or on a hand) drawn as small faint
  eight-point stars. **He says they are "completely removed" (too small and faint now); §3 step 1b.**
- **Sky stars**: 133 stars of the avatar's sky (in the depth map's blue channel) come out around the figure on dark
  paper and in Gear Two, far behind it. Keep them.
- **Cloud bank**: the avatar's billows below the statue and up its left side, baked into the dot maps with their own
  light and shadow, fading into the paper. **He wants the massive part of it only in red; §3 step 1a.**
- **Gear Two (red)**: a header button "Gear Two" (`[data-gear-toggle]`, `aria-pressed`). Switching on runs a 1.05 s
  sequence (`js/motion.js` `switchGear`): a red shockwave ring from the control, a flash, the palette turning red
  under a glitch. While on: the figure is red (stippled from the light map), keeps 40% of its materials' colours
  (`tintFor`), has a double heartbeat every 0.9 s (dot size, a few white-hot dots, the ring's radius), sways 1.6×
  faster, tears tiles out of itself on some beats, and the page shows a drafting crosshair with x/y readouts under the
  cursor (`js/page.js` near "Gear Two: a drafting crosshair", CSS `.crosshair`). **The crosshair goes (§3 step 1c) and
  the button must read as a gear (§3 step 7).**
- **Ring of words**: one line in the statue's voice on a tilted 3D ring around the torso, in Fragment Mono caps, in
  the accent colour; front glyphs have a paper-coloured halo (stroked once into an atlas and drawn from it); a gold
  light reads along the line once every 7 s (ember in red); hovering a theme link brightens it for 400 ms.
- **Reduced motion**: one still frame, nothing moves; two stills are pixel-identical.
- **Papers**: light (white, `#FFFFFF`), dark (`#0B0B0C`), Gear Two (`#080707`, red accent `#FF3B30`). On light paper
  the dots are ink, stippled from `ink.webp` (dense where the statue is dark, like an engraving); on dark paper and in
  Gear Two they are light, stippled from `light.webp` (dense where the statue is lit). A page loads only the map for
  its paper; changing paper fetches the other and swaps the dots behind a wave.

### 2.2 Numbers today

- Dots: 105,788 at 1440 × 900 on light paper (74,024 on dark); 276,489 on a 2× screen (the whole figure is stippled
  twice as fine at 1.5 device pixels per CSS pixel or more); 29,291 at 390 wide (76,485 on a 2× phone); 82,957 at the
  e2e tests' 1280 × 800.
- Hero data at first paint: 199,531 bytes on light paper, 188,033 on dark, against a unit-tested budget of
  200 × 1024 = 204,800 bytes per paper (`ink.webp` or `light.webp` + `depth.webp` + `color.webp` + `bluenoise.png` +
  `hero.json`). **Light paper has only about 5 KB left.** Anything new must load after the first paint, or the
  existing maps must shrink first.
- Frame rate under SwiftShader (how CI renders, §6) at 1280 × 800: 16.3 frames a second on light paper, 19.8 on dark
  (four cores). JS per frame: 0.4–0.7 ms (budget 2 ms; the readout under the caption shows it).
- Tests: 72 unit (`npm test`, under a second), 58 browser (`npm run test:e2e`, 12–15 minutes).

### 2.3 Files

| File | What it is |
|---|---|
| `js/hero.js` | The engine: pure helpers (exported for Node tests), the vertex and fragment shaders (`VERT`, `FRAG` string arrays), `mount()` (loading, `shape()` packs the dots, `size()`, `render()` each frame, the ring, the bolt, input), the public API (`highlight`, `count`, `skipIntro`) |
| `js/page.js` | Mounts the hero, decides the opening, wires its interrupts and `onIntro` to the gear switch, the telemetry readout, the theme links' highlight, and the Gear Two crosshair (to remove) |
| `js/motion.js` | Gear Two (`setGear`, `switchGear(on, origin, transient)`, phases on `<html data-phase>`, the shockwave ring), reduced motion, Lenis |
| `js/theme.js` | Light and dark paper, the theme-colour meta |
| `css/site.css` | Every colour token per mode (`:root`, `[data-theme="dark"]`, the `prefers-color-scheme` block, `[data-gear="two"]`), the hero's rules, the gear button (`.btn.gear`), the crosshair rules |
| `tools/hero/build.py` | Offline data pipeline (numpy + Pillow; torch only for `--upscale`, `--depth`, `--normals`, whose results are cached): the dot maps, the depth map (R depth, G detail, B sky stars), the colour map (R material × 51, G weight, B unused, A 128 + sparkle), `hero.json`, the stills and previews |
| `tools/hero/avatar-424.jpg` | The source: the 424 px avatar. **The ground truth for every comparison.** `assets/avatar.jpg` is a 4× upscale; `depth.png` and `normals.png` in `tools/hero/` are cached model outputs |
| `tools/pages/build.mjs`, `site.json` | The page generator (the caption, the dot count). Run `node tools/pages/build.mjs` after changing either and commit the regenerated HTML |
| `tools/qa/*.mjs` | QA tools (§7): `shots.mjs` (screenshots and the `film` mode), `reel.mjs`, `fps.mjs`, `holdframe.mjs`, `margins.mjs`, `shadercheck.mjs`, `counts.mjs` |
| `test/hero.test.cjs` | Unit tests of the pure helpers and the shipped data |
| `test/e2e/hero-resilience.test.mjs` | Browser tests of the engine through a probe that records GL calls and uniforms (§5) |
| `test/e2e/site.test.mjs`, `explore.test.mjs` | Site-wide browser tests (every page in every mode, the ring's brightening, the caption, printing) |

---

## 3. The work, step by step

**Step 0, the first hour.** Clone the site if needed, `npm ci`, make the Python venv (§7), set `CHROME_PATH`, run
`npm test` and one full `npm run test:e2e` to see it green on your machine. Then look before you touch anything: film
the opening on light and dark paper and an idle turn in Gear Two (`tools/qa/reel.mjs`), open
`tools/hero/avatar-424.jpg` beside the frames, and see for yourself each thing he describes in §1 (the rough edges,
the feathers smearing as the figure turns, the faint stars, the ripple-like shine, the still dots). Note the
baselines of the next paragraph.

Do the steps in this order. Steps 1a–1c are quick and show progress on day one; step 2 is the one he called the
biggest downside; the rest build on it. Push after each step (or each sub-step) when it is green and checked by eye.

Before every step: note the opening's hold-frame hashes (`tools/qa/holdframe.mjs`, light and dark), the frame rate
(`tools/qa/fps.mjs`), and the timing margins on two cores (`tools/qa/margins.mjs`). After it, measure again and say
in the commit what changed.

### Step 1a. The massive cloud only in red

**He said:** "The massive cloud beside the body should only be visible for the red avatar, for now."

**What it means.** The last pass widened the cloud bank in the dot maps: billows below the statue across the band
and up its left side, beside the torso (`fa55fad`, "Give the cloud bank its own light and shadow"). On light and dark
paper that extended bank must not show; only in Gear Two. Before that pass the figure kept a modest cloud under the
statue only (an ellipse under it and a band along the arm, `under` and `arm` in `maps()` of the version at
`8993529`), so the torso never ends in a hard cut. Keep that modest base on every paper, and add the rest only in red.

**What to build.**
1. In `build.py`, compute the bank's own weight: the current figure mask minus the old one (the old `cloud_keep`
   logic), smoothed so it fades in over a few pixels, 0 on the statue. Write it into the colour map's unused blue
   channel (0–255). Check the budget: `color.webp` will grow by a few KB and light paper has about 5 KB left; if it
   does not fit, lower the channel to 16 levels before encoding, or shrink another map first. Do not raise the budget.
2. In `js/hero.js`, `sampleColors` already samples all four channels of the colour map: pack the bank weight into a
   spare vertex byte (byte 28, `a_e.x`, is free; see the layout in §4) and in the vertex shader multiply the dot's
   alpha by `mix(1.0, u_bank, bank)`, where a new uniform `u_bank` is 1 in Gear Two and 0 otherwise. Ease it over the
   gear switch (Gear Two's flash and glitch already cover the change; leaving red, fade it out over about 0.3 s). Keep
   hidden bank dots out of the gust and the breeze.
3. The stills and previews cover loading on light and dark paper (and Gear Two uses the dark one): rebuild them
   without the bank (from each map times one minus the bank weight), run `npm run og` (the share images embed the
   still; a content test checks they are current), and update the dot count in `tools/pages/site.json` and regenerate
   the pages if the 1440 × 900 count changes.

**Traps.** This changes the light-mode first paint on purpose; the still must change with it so the opening's
crossfade has no jump (compare the hold frame with the new still at the same scale). Gear Two's red stipple uses the
light map; the bank dots must come back exactly as they are today in red.

**Done when** light and dark show the statue with only its modest base cloud, Gear Two shows the full bank as today,
switching in and out of red brings the bank in and out without a pop, and the hold frame matches the still.

### Step 1b. Bring the stars back, as the avatar has them

**He said:** "The shiny stars are completely removed. Bring them back like in the original image, in the places where
they add visual beauty and feel, not too bright and not too big."

**What it means.** The last pass shrank the glints to a third and halved their brightness, because he had found them
too big. Now they are too faint to see on light paper. Find the middle: clearly visible stars at the avatar's own
sparkles, sized and spaced like the avatar's, twinkling, never dominant.

**What to build.**
- Put the avatar and the drawn figure side by side at the same scale (crop the wings, the caduceus, the rubble at the
  base) and mark where the avatar's sparkles are. The detector is `glints()` in `js/hero.js` (local peaks of the
  colour map's alpha, at least 0.3, round, not on marble, not inside `features` in `hero.json`, the head and the
  hands). If the shipped map finds too few where the avatar has many (wings, caduceus), lower the floor or look at a
  finer source; never put stars where the avatar has none.
- In the vertex shader's glint block, raise the size and brightness about halfway back toward what they were before
  the last pass (today: size `u_dot * (2.5 + 5 s²) * (0.7 + 0.3 twinkle + 0.3 band)`, brightness
  `(0.15 + 0.35 twinkle + 0.4 band) * tint`; before: `u_dot * (4 + 14 s²) * …`, `(0.3 + 0.7 twinkle + 1.2 band)`). A
  handful of the strongest can carry longer spikes; most stay small. On white paper a white star needs its warm edge
  (`--figure-glint-edge`) to show; judge it on white first.
- Keep them out of the hair and off the hands. Keep the sky stars as they are (dark paper and Gear Two only).

**Done when** side-by-side crops show stars at the same places as the avatar, visible on every paper, the largest no
bigger than about 12 px at 1440 × 900, and he says they look right.

### Step 1c. Remove Gear Two's crosshair

**He said:** "The mouse cursor showing an x axis and a y axis is unnecessary. Remove that for red."

Remove the crosshair and its readout: the block in `js/page.js` ("Gear Two: a drafting crosshair follows the pointer
…"), the `.crosshair*` rules in `css/site.css` (and `.crosshair` in the print rule's list), and the sentence in the
design spec §9 ("Below the hero"). No test covers it. Its replacement is step 8; push the removal on its own now.

### Step 2. Keep the detail when the figure turns (the biggest downside)

**He said:** "When it moves the details get lost: some parts move and some parts don't, and it creates distortion.
The details getting lost as it rotates is the biggest downside at the moment."

**Reproduce it first.** Film the opening and an idle sway with `tools/qa/shots.mjs film` (or `reel.mjs`), and take
frames at yaw 0, at both extremes of the sway (±16°), and in the middle of the opening's fast turn. Crop the wings,
the caduceus, the face, and both hands at 2× and put each crop next to the same crop at rest. Then measure the
distortion directly: for every dot, its screen position at yaw 0 and at yaw 16° (the same projection as the shader:
`rotate()` and `project()` are exported); draw the displacement field. A smooth field is a rigid turn; jumps between
neighbouring dots are the "some parts move and some parts don't" he sees.

**Likely causes, in order of weight** (confirm each with the measurements before fixing it):
1. **Noisy, inconsistent depth.** Each dot's z comes from a monocular depth map (`depth.webp` red, scaled by
   `RELIEF` = 0.34 of the figure's width) smoothed only lightly (`reliefField`, σ 1.5 px). Thin structures (feathers,
   the snakes on the caduceus, the staff, the fingers) carry depth noise and steps from the model, so when the figure
   yaws, neighbouring dots slide by different amounts (x shifts by z · sin(yaw)) and the feathers and coils shear and
   smear. **Fix:** give each rigid part a coherent surface. Build a part map in `build.py` (labels drawn as polygons
   on the 424 px avatar, like the existing zones: left wing, right wing, the caduceus with its small wings and snakes,
   the head, the torso, the raised arm, the outstretched arm and hand, the rubble, the cloud bank), and inside each
   part replace the raw depth by a smooth fit (a heavy edge-preserving smoothing within the part, or a low-order
   surface fit) plus a small, clamped amount of the original detail. Keep the parts' relative depths (the raised arm
   in front of the wing, the caduceus in front of the far wing). Thin, flat parts (the wings) get a narrower depth
   range. The normals for lighting can stay detailed; only the positions need to be coherent.
2. **Lighting that changes dot sizes.** The vertex shader scales each dot's size and alpha by the Lambert term and a
   rim term (`shade`, `fade`), so as the figure turns and the light falls differently, dots grow and shrink across
   whole regions and the engraving's own contrast (which carries the detail) washes out. **Fix:** narrow the
   lighting's effect on size (for example 0.9–1.1 instead of up to ±25%) and carry the turn of the light in colour
   and brightness instead, so the stipple's structure stays put.
3. **Sub-pixel shimmer.** At 1 device pixel per CSS pixel the dots are 1–1.5 px; moving a fraction of a pixel per
   frame they flicker in and out of pixels, and fine features turn into noise. Features also shrink their dots
   (`size *= mix(1.0, 0.82, detail)`), which makes the finest dots alias most. **Fix:** keep the sprite's half-pixel
   margin (§5), drop the detail shrink at 1×, and consider a slightly larger minimum dot at 1×.
4. **The drift, the breeze, and the dust** move single dots during the turn. Keep them coherent (neighbours move
   together) and small; the detail must win.
5. Only if the above is not enough: a slightly smaller `RELIEF`, or a smaller sway. Prefer fixing the depth.

**Traps.** Rebuilding the depth map changes the first paint and the stills: rebuild them, run `npm run og`, and check
the hold frame against the still. Depth feeds the normals too (`depthNormals`), so the lighting changes; check the
figure at rest against the avatar as well. Keep the data budget (§2.2). Geometry must stay deterministic (no
`Math.random`).

**Done when** the 2× crops at both extremes of the sway and mid-turn keep the feathers, the coils, the face, and the
fingers as legible as at rest, no part slides against its neighbour, and a 10 s film of the turn looks like a solid
statue turning. Send him that film.

### Step 3. A clear, defined silhouette

**He said:** "There is no defined boundary to the body, which makes the edges look rough. I want a distinct, very
clear edge."

**What it means.** Today the figure's edge is wherever the stipple thins out, so it is ragged, and on dark paper the
light map deliberately lets the edge fall into the dark. He wants a crisp, continuous outline around the statue (not
around the clouds, which keep their soft fade).

**What to build.**
- Extract the statue's outline at load from the depth map's mask (red > 0, minus the cloud bank): smooth the mask
  (a Gaussian of 1–2 px at 448 px), run marching squares at the 0.5 level, smooth and resample the polyline at an
  even spacing of about 0.6 CSS px at the drawn size. Add the outline as vertices of their own after the dots (like
  the glints, flagged in a spare byte), each at the relief's depth at that point so it turns with the figure.
- Draw them as a fine, continuous line of dots: ink on white paper (slightly smaller than a dot, at full strength),
  a fine soft rim of light on dark paper and in Gear Two (subtle: the owner disliked edges that glow like a negative,
  `docs/next-3.md` §2.2). Inner edges where one part crosses another (the raised arm over the wing, the caduceus over
  the far wing, the outstretched arm against the cloud) deserve a line too; find them from steps in the regularised
  depth of step 2.
- Clip the stipple to the smoothed outline, so no stray dots sit outside the line.
- The outline must also survive the gust and the breeze: dust may leave from it, but the line itself stays.

**Traps.** The outline must be ready at first paint for the hold frame to match the still: either compute it from the
maps already loaded (preferred, costs no data), or ship it; and draw it in the stills too. Keep it deterministic.
Count its vertices (a few thousand at most) against the frame rate (§6).

**Done when** 2× crops of the head, the raised arm, the hand, the wings, and the caduceus show a clean, continuous
edge on every paper, also at the extremes of the turn.

### Step 4. The wings and the caduceus, massively more detailed

**He said:** "The wings can be massively more detailed, and the sword too."

**What it means.** The feathers (rows of long flight feathers with clear edges, and the small coverts near the
shoulder) and the caduceus (the staff, the two snakes coiling up it with their heads facing each other, the small
wings at the top) are mush today, especially at 1×. The source is only 424 px, so the detail must come from drawing
technique, never from invented anatomy: check every crop against `tools/hero/avatar-424.jpg`.

**What to build** (prototype on crops first, then commit to what works):
- **Edge-aware stippling.** Feather edges and the snakes' outlines are the image's strongest local edges. Build an
  edge map in `build.py` (difference of Gaussians or a structure-tensor edge strength on the 1696 px upscale, limited
  to the wings and the caduceus by the part map of step 2) and raise the ink (and, on dark paper, the light) along
  edges, so dots line up along each feather's edge.
- **Strokes along the feathers.** The structure tensor also gives each pixel's orientation. In the wing zones, place
  the stipple in short runs along that orientation (an engraving's hatching), so each feather reads as drawn with
  lines. Prototype this first on a crop; it is the change most likely to look striking, and the one most likely to
  look wrong.
- **A finer grid where it matters.** At 1× only, give the wings and the caduceus a grid 1.5–2× finer with smaller
  dots, in the same tone (`fineScale` already does this for the whole figure at 2×); count what it costs (§6).
- **Material detail.** Gold catches light on feather edges and bronze sits in the gaps: let the lit/base gold follow
  the edge map, not only the lighting.
- Step 2's rigid parts keep all of this intact when the figure turns.

**Done when** 2× crops of the wings and the caduceus, beside the avatar, show the feather rows and the snakes' coils
clearly on every paper, at rest and mid-turn.

### Step 5. A shine with depth, from one side, in the right colour for each mode

**He said:** "The shine should come from one side and have much more depth. It should look surreal. For every
background, and for the blue and red modes, the shine should have a different colour. The current shine is like a
white ripple with no wow factor." (Earlier he asked for the shine to "happen from the body"; the ring running out of
the chest was that answer, and he has now seen it. Replace it.)

**What to build.** A sheet of light that sweeps across the statue from one side, through its depth:
- **One side, every time.** The light comes from the key light's side (upper left) and leaves at the lower right, at
  every sheen, the opening's included. (Today's ring runs out of `u_core`; the band's position, the gust's timing
  `reached()`, the stars' timing, the opening's colour reveal behind the band, `u_swap`'s paper swap, and the ring's
  glyph lift all read the same "how far along the light's way" value: change it in one place.)
- **Depth.** Position the band in 3D, not on the screen: for each dot use its rotated 3D position, and let the band
  be a plane moving along the light's direction, so its line bends over the forms (around the chest, along the arm,
  across the wings) and reads as light passing through a solid. Add a specular term (the half-vector between the
  sweeping light and the viewer against the rotated normal, raised to a power by repeated squaring, not `pow`) so
  surfaces facing it flash as it passes, and a soft afterglow that lingers on the most lit surfaces.
- **Surreal.** A thin second band of a complementary hue a little ahead of the main one (a prismatic fringe), the
  brightest dots swelling into soft points, a few glints flaring as the band crosses their places, and the fine dust
  in the band's colour for a moment as it leaves. Restraint matters more than effects: it must feel like one
  beautiful light, not a show.
- **Colour per mode** (CSS custom properties, `--figure-sheen`, `--figure-sheen-core`, `--figure-star`, plus a new
  fringe token; decide by eye on each paper): he loved the gold ("the yellow shine going through"), so start from
  molten gold with a pale core on white paper; gold with a white-hot core on dark paper; molten ember (orange-gold) in
  red; and in blue, try both an electric cyan and gold sweeping through the blue figure, and show him both.
- Keep the gust calm (fine dust in the figure's own colours), keep the opening's timing and its colour reveal behind
  the band, and keep the tests' contract on `u_sheen` (its first value is the eased progress 0→1; the sweep must
  finish within 8 s of load; nothing under reduced motion).

**Done when** a clip of the shine on light paper, dark paper, red, and blue reads at a glance as a deep, surreal light
crossing a 3D statue, and he says it has the wow factor. Send him the first version as soon as it runs.

### Step 6. Dots that flow; a figure that feels alive

**He said:** "The dots are not flowing whatsoever; they are supposed to move. The avatar should look and feel real;
it's only moving a very little. I need something that adds realism, like the red version."

**What it means.** The red mode feels alive because it has a pulse (the heartbeat), a faster sway, and events (the
tears). Light and dark paper have only a slow sway and almost invisible drift. Give them a life of their own that
reads as a real statue in a real scene: coherent, continuous motion, never noise, and never at the cost of step 2's
detail.

**What to build** (each on its own, filmed, then together):
- **Breathing.** The torso and the head rise and fall on a slow 4–5 s cycle (a scale of 0.5–1% around the chest,
  `core`), with the shoulders following.
- **Living parts.** With step 2's part map in the vertex data, move parts as rigid bodies by small amounts: the wings
  open and close a little around their shoulder joints (tips 1–2% of the figure's width, 6–8 s), the curls sway in
  the breeze, the snakes on the caduceus undulate with a phase running up the staff, the raised arm holds still (it
  carries the caduceus). Compute each part's small rotation in JS once a frame and pass it as uniforms (a handful of
  `vec4`s); the shader picks its part's transform by the part index.
- **Flowing light over the surface.** Slow, coherent currents of brightness running across the stone along a flow
  field (a few sine terms in the figure's own coordinates are enough), and a few dots riding them along closed loops a
  pixel or two long, so the surface shimmers like flowing sand without losing its structure. This is the "dots
  flowing" he asked for; keep it subtle at rest and stronger while a sheen passes.
- **A moving key light.** The light direction drifts by a few degrees over 20–30 s, as if clouds pass the sun, so
  the shading changes gently on its own.
- Gear Two keeps its heartbeat and adds the parts' motion. Blue gets its own rhythm (step 7).

**Rules.** Nothing moves under reduced motion or while the opening holds the figure still (`hold` and `shine`
stages). Every new uniform is constant under reduced motion (two stills must hash identically). Mind the shader cost
(§6): the parts' transforms are a few multiply-adds per dot; avoid loops and transcendental math per dot.

**Done when** a 10 s idle clip on light and dark paper feels alive and real to him, and step 2's crops still hold.

### Step 7. The blue gear (manual only), and a gear control that shows the gear

**He said:** "I need a blue-pill animation gear that changes everything to blue. No lightning. Some crazy animation in
blue, like the yellow shine going through, that looks visually stunning. Only reachable manually." And: "When the red
mode is on, the button doesn't show it as a gear; it just turns red."

**What it means.** A third state beside the normal page and Gear Two: a blue mode, the red pill's counterpart, with
its own stunning entrance and its own life, reached only from the control (never in the opening, never
automatically). And the control itself must read as a gear shift that shows which gear is engaged, not a button
that changes colour.

**What to build.**
1. **Modes.** Generalise Gear Two's on/off into modes: none, `two` (red), `blue`. `<html data-gear="two">` stays as
   it is; blue is `data-gear="blue"`. `js/motion.js`: `setGear`/`switchGear` take a mode; `sessionStorage['sky-gear']`
   keeps `two` or `blue` (as Gear Two is kept today when switched by hand; transient switches are never saved); the
   lights' switch leaves either gear, as it leaves Gear Two today. `js/hero.js` `readColors()` reads the mode (today
   `gear` is a boolean for `two`); everything that tests `colors.gear` must be checked for what blue should do.
2. **Palette.** `:root[data-gear="blue"]` in `css/site.css`, with every token Gear Two sets: a deep blue-black paper,
   an ice-blue ink, an electric blue accent with enough contrast (check WCAG AA like the table in spec §5), the
   figure's ink, fill and key, the materials, the glint colours, the shine (step 5). The figure is stippled from the
   light map, as on dark paper.
3. **Entrance (no lightning).** About 1.2 s, as choreographed as Gear Two's: for example the figure's dots lift off
   into a slow blue vortex around the body and settle back as the palette turns (the assembly's shell is a starting
   point: `k` goes 1 → 0 → 1 with a swirl), a cool ring leaving the control like Gear Two's red one, and the step 5
   shine sweeping through the blue figure as it settles. Leaving blue is quicker and quieter.
4. **While on.** A calm rhythm of its own instead of the heartbeat (a slow tide of light rising through the figure
   every few seconds, the parts' motion of step 6, the sky stars brighter), no tears, no lightning.
5. **The control.** Keep it in the header's centre, mono, bordered, as the design system has it, but make it a gear
   shift: the gears it can engage (Gear Two, and the blue gear, named by you or by him; show him) as positions with a
   clear engaged state that does not depend on colour alone, a short mechanical shift animation when the mode changes
   (an indicator sliding between positions, or a gear glyph turning a notch), and full keyboard and screen-reader
   support (buttons with `aria-pressed`, or a radio group). It must fit the header at 390 px wide. Gear Two's existing
   behaviour, its pulse in time with the heartbeat (`--beat-delay`), and its tests stay.
6. **Tests.** Extend `test/motion.test.cjs` and `test/theme.test.cjs` for the mode switch, add blue to the e2e
   "every page loads cleanly at every width in light, dark, and Gear Two" run, check the opening never visits blue,
   and that reduced motion switches at once.

**Done when** he can switch to blue from the control, the entrance and the mode feel stunning and premium to him,
the control reads as a gear shift in both gears, and every test is green. Send him the first clip early.

### Step 8. Something beautiful under the cursor in red

**He said:** "Add something stunning that is perfect in this context" (instead of the crosshair).

**What to build.** A cursor effect that belongs to the red mode's world (fire, embers, a pulse), subtle and premium:
for example a soft ember glow that follows the pointer across the page (an element moved by `transform`, no layout),
leaving a short trail of a few dozen small embers that drift and fade (a fixed, pointer-transparent canvas, animated
only while the pointer moves), and over the figure, the dots under the cursor running ember-hot (the shader already
knows the pointer, `u_pointer`). Its colours come from Gear Two's tokens. In blue, decide with him whether it gets a
cool counterpart. Nothing under reduced motion, nothing on touch, under 1 ms a frame.

**Done when** he says it is perfect for the red mode.

### Step 9. Docs, the final reel, the report

Update `README.md` (the `js/hero.js` paragraph and the page's features), `docs/design-spec.md` (§5 palette, §7 engine,
§8 motion, §9 Gear Two and the blue mode, §14 tests) to describe what is live, and this document's status line. Then
the report of §8.

---

## 4. How the engine works

- **Load** (`mount()`): fetch the dot map for the paper, `depth.webp`, `bluenoise.png`, `hero.json`, and (optional)
  `color.webp`; validate `hero.json`; `reliefField()` smooths the depth inside the figure; `initialize()` compiles the
  one program, creates the one buffer and the one VAO, and calls `size()`.
- **`size()`** (and on resize): the canvas is the figure's box plus 18% padding on each side, at `min(2, DPR)`;
  `fit()` places the figure's bounds; `resolutionFor()` picks the grid (1.4 cells per CSS pixel of the figure's
  width, 320–1200); `shape()` builds the vertex buffer for the current map.
- **`shape()`**: `stipple()` thresholds the map against the blue-noise tile (twice as fine at DPR ≥ 1.5,
  `fineScale`); for each dot: depth and normal (`depthNormals`), detail and material (`sampleColors`,
  `materialAt`), the outline's direction and distance (`outlineField`); then the glints (`glints`), then the sky stars
  (`skyStars`). Each vertex is 36 bytes:

  | Bytes | Attribute | Meaning |
  |---|---|---|
  | 0–15 | `a_p` (4 floats) | x, y (figure units, 0–1 across the map), depth (0–1), ink |
  | 16–23 | `a_n` (2 floats) | surface normal x, y (z is rebuilt) |
  | 24–27 | `a_c` (4 bytes) | material × 51, its weight (sky star flag on a star), detail, 128 + sparkle |
  | 28–31 | `a_e` (4 bytes) | **spare**, **spare**, fine-grid scale, glint flag |
  | 32–35 | `a_w` (4 bytes) | **spare**, **spare**, which way is out of the figure, how far in |

  Four spare bytes: the bank weight (step 1a), the part index (steps 2 and 6), the outline flag (step 3) can live
  there without widening the vertex.

  **Where new per-pixel data can live without new files:** the colour map's blue channel is unused (a soft weight such
  as the cloud bank's); the depth map's blue holds the sky's stars only outside the figure (red 0), so inside the
  figure it is free for discrete labels such as the part map (a few flat regions compress to a KB or two). Check the
  budget after every change to a map (`npm test` does).
- **`render()`** each frame: the opening's state machine; springs for yaw and pitch (sway plus the cursor's lean or a
  touch drag); sheen triggers at the turns of the sway (`sheenPhase`); Gear Two's heartbeat and tears; uniforms; one
  `drawArrays(POINTS)` (two more faint ones for afterimages in Gear Two's glitch, one more during a paper swap); the
  ring on a 2D overlay canvas; the bolt. Each frame first checks that the figure is on screen.
- **Vertex shader order:** assembly from a shell → rotation of point and normal → lighting → the cursor's stir → the
  opening's strike ring → Gear Two's slices and tiles → material colour → the sheen (band, afterglow, stars) → the
  gusts (one loop over this sheen and the last) → the breeze → the cursor's puffs → the paper swap → colour → the
  drift → size and alpha → the glint block.
- **Fragment shader:** a disc, plus shared shapes (four arms, one halo) for a burst star, a grain of dust's short
  tail, a flare, and a glint's eight points. Varyings are flat.
- **Colours** come from CSS custom properties, read by `readColors()` on every theme change (a `MutationObserver` on
  `<html>` watches `data-theme`, `data-gear`, `data-phase`). Keep colour decisions in CSS.

---

## 5. Traps (all found the hard way)

1. **The first paint.** The still that covers loading (`still.webp`, `preview.webp`, and their `-dark` versions) is
   drawn at the engine's framing from the same map, so it fades into the opening's first drawn frame in place, with no
   jump. For any change that is not meant to change the figure itself, `tools/qa/holdframe.mjs` must print the same
   hash as the commit before (light and dark): the first frame stays pixel-identical. A change that does change the
   figure (steps 1a, 2, 3, 4) must rebuild the stills (`build.py`), the share images (`npm run og`), and the dot count.
   Glint vertices once drew big black blots in this frame because they had no light yet: every new kind of vertex must
   draw nothing until its light arrives (`u_tint`), unless it is part of the still.
2. **Lights tie to `u_tint`.** Without the colour map every dot is plain ink, and nothing glows: multiply every new
   light by the tint.
3. **Reduced motion is one still, and two stills are pixel-identical.** Nothing time-based may reach that frame; every
   new uniform is constant there. Nothing moves in the opening's `hold` and `shine` stages either, except the
   opening's own shine and its dust.
4. **The probe's contract** (`test/e2e/hero-resilience.test.mjs`): it counts `createProgram`, `createBuffer`, and
   `createVertexArray` on the hero canvas per context restoration (one each today), records every `bufferData` (bytes
   and a hash, which must be equal across restorations, so geometry is deterministic: never `Math.random`), and
   records uniforms set with `uniform1f/2f/3f/4f/4fv` by name. Tests read `u_rip`, `u_pointer`, `u_swap`, `u_tint`,
   `u_sheen`, `u_glitch`, `u_positive`, `u_rot`, `u_flow`, `u_build`, `u_blink`, `u_span`, `u_sky`, `u_puff`,
   `u_breeze`, `u_time`, `u_stir`, `u_last`, `u_beat`, `u_alpha`: keep their meanings. A second program (for example a
   cheap one for scenery) is allowed but changes the contract: update the probe to count it apart (tag it by its
   shader source), keep the figure's draws counted as they are, and say so in the commit.
5. **SwiftShader runs every branch.** See §6. An `if` costs both sides; only a loop's extra turns are skipped.
6. **Timing tests depend on frame rate.** The touch drag must change yaw by more than 0.06 in 850 ms (springs advance at
   most 50 ms per frame); the ring's brightening is measured from the link's `mouseenter`; the opening's hold is
   counted from the moment the figure is marked live and must measure 1.9–4 s; an off-screen figure must not draw. Run
   `tools/qa/margins.mjs` on two cores (`taskset -c 0,1`) before pushing anything that costs frames.
7. **The ring's brightening test sums `globalAlpha` over `fillText` calls on the overlay per frame.** Keep drawing the
   glyphs with `fillText` and their alpha; colour and size may change. The halos are drawn with `drawImage`.
8. **The data budget** (§2.2): 5 KB left on light paper. Load new data after the first paint, or shrink first.
9. **Maps are lossless WebP (VP8L) with no colour profile** (a unit test checks the header), saved with Pillow's
   `exact=True`. Browsers premultiply canvas pixels by alpha, so a map read through a canvas keeps alpha at 128 or
   more.
10. **`build.py` rebuilds everything** unless told otherwise (`--color`, `--stars` write one thing). After a rebuild:
    `npm run og`, the dot count in `tools/pages/site.json`, `node tools/pages/build.mjs`, and commit every output.
11. **GLSL:** run `tools/qa/shadercheck.mjs` after every shader edit (it compiles both shaders and rejects reserved
    words such as `patch`, `sample`, `input`, `output`, `filter`, `active`, `common`).
12. **Gear Two's CSS pulses** use `animation-delay: var(--beat-delay, 0s)` and a 0.9 s period; any new pulse does the
    same (the blue mode's own rhythm gets its own variable).
13. **The opening** never visits blue, ends on any press, key, or wheel, and never saves Gear Two.
14. **On Capy machines use `CHROME_PATH=/usr/bin/google-chrome-stable`.** `/usr/local/bin/google-chrome` is a wrapper
    that starts the desktop browser service, which takes CPU from timing tests. Never run `fps.mjs`, a film, or a reel
    while the e2e suite runs: the timing tests will fail for no reason.
15. **Motion under software rendering** can only be judged in the `film` mode or `reel.mjs` (virtual time); a screen
    recording runs at a few frames a second.
16. **Each dot's sprite is half a device pixel wider than the dot** (`v_sprite += 0.5`), so most of the soft edge of a
    small dot is drawn instead of clipped; without it the drawn figure looks paler than the still it replaces. Keep it
    for every new kind of point.
17. **Two numbers decide the figure's look on load and must stay in step:** the dot count printed in the caption
    (`tools/pages/site.json`, 1440 × 900 on light paper) and the still. A unit test checks the share images are
    current, and the pages generator must reproduce every committed page byte for byte.

---

## 6. Performance: what SwiftShader costs

CI renders WebGL with SwiftShader, on the CPU. It **runs every instruction of a shader for every vertex and every
pixel, whether a branch is taken or not**, and runs the body of every loop at least once; only a loop's further turns
are skipped when no lane needs them. So the cost of the vertex shader is its total amount of code, times the number
of dots. Measured on this figure (1280 × 800, light paper), roughly: 60% of a frame is the vertex shader, 25% the
fragment shader and rasterising, and 10–15% the ring's 2D text.

- Loops over a varying number of live things run to a uniform count (`u_blast`, `u_gusts`, `u_tiles`), with the live
  entries packed first in their arrays. Never write a fixed-length loop over mostly empty slots.
- Merge mutually exclusive code into one path (the fragment shader shares one distance, one pair of arms, and one
  halo between its shapes).
- Avoid `pow`, `exp`, `log`, `acos`, `atan` per dot where a few multiplications do; compute anything that is the same
  for every dot once a frame in JS and pass it as a uniform (`u_wind`).
- New vertices cost the whole vertex shader each: a few thousand (outline, stars) are fine; tens of thousands need a
  reason, or a second, much cheaper program (trap 4).
- Profile before guessing: `SUBS` in `tools/qa/fps.mjs` rewrites the shader source before it compiles (cull every
  vertex after a few seconds to measure the vertex shader alone; replace the fragment shader's body to measure its
  share), and `NORING=1` drops the ring's glyphs.
- Keep the frame rate at or above today's (16.3 and 19.8 at 1280 × 800) and the margins on two cores (touch drag
  yaw change ≥ 0.09, ring ratio ≥ 1.5). If a step needs more, find the frames elsewhere first.

---

## 7. Commands and the QA protocol

```sh
npm ci                                            # once
python3 -m venv ~/hero-venv && ~/hero-venv/bin/pip install numpy pillow   # outside the repo
~/hero-venv/bin/python tools/hero/build.py        # rebuild the hero data (then npm run og, site.json, pages)
export CHROME_PATH=/usr/bin/google-chrome-stable  # on Capy machines
npm test                                          # unit tests, under a second
npm run test:e2e                                  # browser tests, 12-15 min; a quiet machine
taskset -c 0,1 npm run test:e2e                   # the same on two cores, close to CI's speed
node --test --test-name-pattern="opening" test/e2e/hero-resilience.test.mjs   # one group
node tools/qa/shadercheck.mjs                     # compile both shaders, check reserved words
node tools/qa/holdframe.mjs                       # the opening's first frame, hashed (SCHEME=light|dark; ROOT=<worktree>)
RUNS=2 node tools/qa/fps.mjs                      # frames a second at 1280 x 800, light and dark (ROOT=<worktree> to compare)
taskset -c 0,1 node tools/qa/margins.mjs          # the timing tests' margins as CI sees them
node tools/qa/counts.mjs                          # dot counts per paper, size, and DPR
node tools/qa/reel.mjs out/ && ffmpeg -framerate 25 -i out/f%04d.png -vf "scale=672:-2,format=yuv420p" -c:v libx264 -crf 25 reel.mp4
node tools/qa/shots.mjs film frames/ light 13 1440 900 25   # the opening, frame by frame (serve the repo on :8080 first)
git worktree add /tmp/base <commit>               # an older commit to compare against (ROOT=/tmp/base)
```

**For every visual change:** look at light paper, dark paper, Gear Two, and blue, at 1440 × 900 and 390 × 844, at
DPR 1 and 2; film the opening and an idle turn; make 2× crops (the face, both hands, the wings, the caduceus, the
chest) beside the same crops of `tools/hero/avatar-424.jpg`; check the hold frame; measure the frame rate and the
margins; run the full e2e suite (ideally on two cores) before pushing; confirm CI after pushing.

---

## 8. Definition of done, and how to report

1. Every step of §3 is live on `main`, each as its own commit or short series, CI green after each push.
2. New behaviour has tests: unit tests for new pure helpers (the part map's use, the outline, the mode switch, any
   exported function), and probe-based e2e checks where behaviour is observable (the bank only in red, the blue mode
   only by hand, no crosshair, nothing new under reduced motion, the opening untouched).
3. `README.md`, `docs/design-spec.md` (§5, §7, §8, §9, §14), and this document's status line describe what is live.
4. Each report to the owner leads with a short video (the opening in light and dark, an idle turn, the shine in every
   mode, the blue entrance, the red cursor) and 2× crops beside the avatar, then a few plain lines: what changed, the
   numbers (dots, frames a second, data, first-frame time), and anything not done or not verified. He judges by eye:
   show, then tell.

## 9. Decisions already made (do not reopen them)

- No lightning by hand, ever; one bolt only in the opening's automatic switch to red.
- No glow drawn on the page beside the figure.
- Dust stays fine, in the figure's own colours, fading into the paper; nothing heavy rises.
- Dots never blink; they drift and flow (step 6 makes the flow visible).
- No stars in the hair or on the hands; sky stars only on dark paper, in red, and (your call) in blue.
- The ring of words, its halo, and its gold light stay.
- The opening's choreography and timing stay.

**Show him before polishing:** the new shine (step 5), the blue mode's entrance and its shine colour, the gear
control, and the red cursor effect. A 5–10 s clip each.
