# Handoff 5: finish the hero pass (the shine, a living figure, Tide's own entrance, the red cursor's dots, the docs)

> **Status.** Live on `main`: step 6, the living figure ("Let the figure live…": part labels in byte 29, `joints` in
> `hero.json`, `life()` in JS and the parts' transforms in the shader, the currents of light with the dots riding them,
> the curls and the snakes, the drifting key light, the drift halved). Where it departs from §3: the caduceus below the
> fist is a part of its own in the vertex (label 8, the staff: the small wings beat about the staff's top while the
> snakes sway below, pinned where they cross the staff, which holds still); the currents' displacement is the waves'
> own longitudinal motion (no extra trig), with one dot in twenty riding 2.5× further; the breath is 0.5% about the
> chest plus a 0.25% lift, and its cycle (4.5 s) is Tide's, so the chest rises with the tide; the head and the arms
> only ride the breath (no turn of the head); and the colours of the currents lean the ink to the key by a few percent
> only. The hold frame is bit-identical (every motion is exactly zero at rest). Before it: step 7's engine side, Tide's
> vortex and tide ("Bring Tide into the figure…"; as briefed),
> and step 5, the shine (`e4383f0`), after a commit that finds frames for the pass
> (`b153719`: the cloud bank's own dots are not drawn while it is away; the ring draws a halo only where it hides
> something). Where it departs from §3: the sweep's progress is linear (the cubic ease rushed the light across the
> figure's middle in 0.3 s), idle sheens take 1.4 s, and the opening keeps its 1.4 s shine and a 1.1 s red shine
> (`INTRO.redSweep`); WAY weighs depth more than the key light (`[0.45, -0.6, -1.0]`); the band became a sharp line with a
> warm wash behind it, and the fringe runs on the stone only (on gold it went grey). Tide's shine is cyan until the owner
> picks gold. New hold-frame hashes (the vertex order moved): light `3763294288`, dark `656134758`. Also fixed: CI had
> been red since 17:30 UTC on 5 October because the contact dial's "you" label ran past a 390 px screen between about
> 17:15 and 18:45 local time (`2312b4c`). Whoever works on this updates this line after every push: which steps of §3
> are live on `main`, and where the build departed from this brief, and why.

You are taking over the hero figure of Aakash Dahal's portfolio, https://skysssup.github.io: his GitHub avatar (a winged
statue of Hermes raising a caduceus, rising out of clouds into a starry sky) drawn as a turning WebGL sculpture of
about 80,000 dots. The previous agent worked through `docs/next-4.md` (read it: it holds the owner's words for this pass
and the full engine map) and finished most of it; this document is your complete brief for everything that is left.
Read all of it, then `docs/next-4.md` §1 (the owner's words), §4 (engine), §5 (traps), §6 (SwiftShader), before you
change anything. Come back to §5 here whenever you are unsure.

The owner's goal, in his words: **the figure must look and feel real, keep its detail when it moves, and be visually
stunning, in a calm, premium way.** He is 19; the site goes to Andreessen Horowitz program reviewers. Stunning but
controlled, never gimmicky. He judges only by eye.

---

## 0. Ground rules (unchanged from next-4 §0; the ones that bit)

- Repository `skysssup/skysssup.github.io` (GitHub Pages from `main`, live about 30 s after a push). If your workspace
  checked out `skysssup/skysssup` (his profile repo), clone the site: `git clone https://git.capy.ai/skysssup/skysssup.github.io.git`.
- **Commit straight to `main`, no pull requests** (his standing preference). One coherent commit per step, a plain
  sentence subject saying what the visitor now sees, a body saying what changed, why, and what you measured. Read
  `git log -12` and match it.
- **CI must be green after every push** (`gh run list -R skysssup/skysssup.github.io -L 3`). One known flake: the
  site test "keyboard: the skip link comes first" failed once on CI (`#main` not in the URL right after Enter) and
  passed on the next run with the same code and locally every time. If it fails, look at the log, rerun it locally on
  two cores (`taskset -c 0,1 node --test --test-name-pattern="keyboard" test/e2e/site.test.mjs`), and only chase it if
  it fails again.
- **Report with a short video first, then a few lines.** For the big visual changes (the shine, Tide's entrance, the
  living figure) send him a 5–10 s clip as soon as a first version runs, before polishing. Do not stop and wait for
  answers: take the reading given here, build it, show it.
- Never print or commit a secret. If `git push` fails with "Invalid username or token", ask him to reconnect GitHub in
  Capy (Settings → Integrations → GitHub).
- Budget your work: the previous agent ran out of credit mid-step. Push each step as soon as it is green; keep WIP on a
  branch (as `shine-wip` is) rather than leaving it only on a machine.

## 1. Setup (first 20 minutes)

```sh
git clone https://git.capy.ai/skysssup/skysssup.github.io.git site && cd site
npm ci
python3 -m venv ~/hero-venv && ~/hero-venv/bin/pip install numpy pillow     # outside the repo
export CHROME_PATH=/usr/bin/google-chrome-stable    # ALWAYS on Capy machines (/usr/local/bin/google-chrome steals CPU)
npm test                                            # 87 unit tests, under a second
npm run test:e2e                                    # 63 browser tests, ~15 min on 4 cores (Tide added ~4 min)
~/hero-venv/bin/python tools/hero/build.py          # ~25 s; must reproduce assets/hero byte for byte (git status clean)
git fetch origin shine-wip                          # step 5's first cut (see §3, step 5)
```

Then measure the baselines you will compare against (on a quiet machine, never while the e2e suite runs):

```sh
for s in light dark; do SCHEME=$s OUT=/tmp/hold-$s.raw node tools/qa/holdframe.mjs; done   # hashes + raw frames
~/hero-venv/bin/python tools/qa/stillmatch.py        # the still against the first frame, block by block
RUNS=2 node tools/qa/fps.mjs                         # at 3d2f8dc: 17.1 light, 20.4 dark (1280 x 800, SwiftShader)
taskset -c 0,1 node tools/qa/margins.mjs             # at 3d2f8dc: touch yaw 0.098-0.112, ring 1.64-1.70
node tools/qa/slide.mjs                              # how unevenly dots slide at 16 deg: p95 1.18 px, 1.25% > 2 px
node tools/qa/counts.mjs                             # 81,465 dots at 1440 x 900 light (the caption, site.json)
```

Hold-frame hashes at `3d2f8dc` (1440 x 900, DPR 1): light `538080848` (visible 96,683), dark `4212722822` (visible
88,954). stillmatch: light block median 1.014, dark 1.044. Hero data at first paint: 182,319 bytes on light paper,
173,225 on dark (budget 204,800 per paper: about 22 KB of headroom now).

## 2. Where things stand (live on `main` unless said)

| Commit | What the visitor sees | How (where to look) |
|---|---|---|
| `52d0bcc` | Gear Two's crosshair is gone | `js/page.js`, `css/site.css` |
| `a1db9e1` | The big cloud bank shows only in Gear Two; light and dark paper keep the modest base cloud | `build.py` writes the bank's own share into `color.webp`'s blue (16 levels); the engine flags each dot only the bank holds (`a_e.x`, byte 28), `u_bank` eases 0.3 s; hidden dots are moved out of view (no pixels); the caption counts the dots drawn |
| `25cc650` | The avatar's stars are back, clearly visible, never dominant | glint block in the vertex shader (sizes 3.5–11.5 dots, ≥55% strong, one in five of the full-sparkle ones carries longer spikes); on white paper dark sepia rays (`--figure-glint-edge #2E2010`) at ≥0.9 px and a glow that lights the gold; peach in Gear Two |
| `b842192` | The figure turns as a solid statue: edges no longer spray apart | `parts()` and `rigid()` in `build.py` (seven parts drawn as polygons on the avatar; each part's depth smoothed inside its solid core and carried to its outline, blended over a few px where parts meet); `tools/qa/slide.mjs` measures it; the detail shrink only on ≥1.5x screens; `STILL_GAIN` |
| `47aece4` `021c47a` | The gear shift `TWO ⚙ TIDE` (a cog rolls to the engaged gear's notch); Tide, the blue gear, floods the page from the control; in Gear Two a soft ember glow and a trail of embers follow the cursor | `js/motion.js` (modes, `BLUE`, `TIDE = 4.5`, `--tide-delay`, phases `surge` 0–1200 ms with the palette at ~120 ms inside a View Transition, `ebb` 300 ms), `css/site.css` (`:root[data-gear="blue"]`, the control, the embers' tokens `--trail*`), `js/page.js` (the ember canvas), `tools/pages/build.mjs` (header, BOOT/PREVIEW) |
| `77211e7` | The opening leaves a gear chosen by hand alone (Tide included) | `readColors().blue`; `introStep(..., gear || colors.blue)` |
| `610f1fe` | The statue has a clear, continuous edge; no stray dots outside it | depth map's blue names each pixel's part inside the figure (`label × 32`, less 16 in the soft fringe); `edges()` traces each part (marching squares) and keeps a point where the sky or a part it lies in front of (`over` in `hero.json`) is beyond; outline vertices flagged in `a_w.x` (byte 32); the stipple is clipped to it; `outline()` in `build.py` mirrors it for the stills |
| `3d2f8dc` | The wings and the caduceus are drawn in engraved strokes along their feathers and coils | `feathers()` in `build.py` (local-contrast detail with the glitter opened away), `strokes()` + `stipple(..., strokes)` (runs of 3 along the structure tensor's direction), gold lit on feather edges in the shader |
| branch `shine-wip` (`ddf8071`) | NOT LIVE. Step 5's first cut: compiles, unit tests pass, never looked at, filmed, or e2e-tested | see §3, step 5 |

Open questions to the owner, already asked (take the default if he has not answered): the blue gear's name is "Tide"
(alternative "Halcyon"; "Blue Pill" rejected as an internet meme); Tide's shine colour (show both cyan and gold, §3
step 5); whether Tide gets a cool cursor trail (the default is no: Tide's stillness is the contrast with red).

### 2.1 The vertex (36 bytes) and the data, as they are now

| Bytes | Attribute | Meaning |
|---|---|---|
| 0–15 | `a_p` | x, y (figure units), depth (0–1), ink (dot map value; 0.5 for outline points) |
| 16–23 | `a_n` | surface normal x, y |
| 24–27 | `a_c` | material × 51, its weight (sky-star flag on a star), detail, 128 + sparkle |
| 28 | `a_e.x` | 255 = a dot only the cloud bank holds (drawn in Gear Two only) |
| 29 | `a_e.y` | **spare** (planned: the part label, step 6) |
| 30 | `a_e.z` | fine-grid scale |
| 31 | `a_e.w` | 255 = glint or sky star |
| 32 | `a_w.x` | 255 = outline point |
| 33 | `a_w.y` | **spare** |
| 34 | `a_w.z` | which way is out (fraction of a turn); for outline points the edge's outward direction |
| 35 | `a_w.w` | how far in from the outline (0 for outline points) |

Vertex order in the buffer: dots, then glints, then sky stars, then outline points (`shape()`).

- `depth.webp` (448): R relief as rigid parts (0 outside the figure), G detail, B inside the figure the part code
  (`round(B / 32)` = index in `hero.json` `parts`, 1-based: wing, caduceus, arm, head, torso, reach, base; `B % 32 == 16`
  = soft fringe), outside the figure the sky's stars. `partOf(rgba, i)` in `js/hero.js` decodes it.
- `color.webp` (448): R material × 51, G weight, B the cloud bank's own share (16 levels), A 128 + sparkle.
- `hero.json`: `bounds`, `center` (the pivot), `core` (no longer used once step 5 lands; keep it, the metadata check
  accepts it), `density`, `ring`, `features` (head and hands' ellipses: no glints there), `parts`, `over`.

---

## 3. The remaining work, step by step

Order: **5 → 7 (engine side) → 6 → 8 (engine side) → 9.** Step 7's entrance reuses step 5's shine, and step 6's
motion is the riskiest for frame rate, so do it once the visual steps are in. Push after each step when green and
checked by eye. Before each step note the hold-frame hashes, fps, and margins (§1); after it, measure again and put the
numbers in the commit.

### Step 5. A shine with depth, from one side, in the right colour for each mode (first cut on `shine-wip`)

**He said:** "The shine should come from one side and have much more depth. It should look surreal. For every
background, and for the blue and red modes, the shine should have a different colour. The current shine is like a white
ripple with no wow factor."

**What `shine-wip` already does** (`git diff main shine-wip`; review every line, it was never run in a browser):
- The radial wave out of the chest (`outward()`, `u_core`) is gone. `way(p)` gives each dot's place along a plane that
  sweeps the turned figure along the light's own direction: `WAY = -normalize(LIGHT)` (from the upper left, in front,
  to the lower right, behind), normalised per frame by `sheenWay(meta, yaw, pitch)` (the statue's bounds, the clouds
  below, the relief's depth range, turned) into 0..1 with a margin `WAY_MARGIN = 0.12` either side. Uniforms:
  `u_way` (vec4: WAY, lo), `u_wayk` (vec2: 1 / (hi − lo), margin), `u_drift` (vec2: WAY on the screen, where the gust
  blows). `u_span.z` is now the band's width as a share of the sweep (0.045 on light and dark paper, 0.035 in Gear Two).
- One coordinate drives everything, as the brief asked: the band, the burst's stars (`reached(c)`), the gusts
  (`since = age − reached(c) · sweep`), the opening's colour reveal behind the band (`wake`), the paper swap (`u_swap`),
  and the ring's glyph lift (`wayAt()` in JS, the glyphs stirred along `DRIFT`).
- Band strength is `0.35 + 0.65 · max(dot(n, −WAY), 0)` (surfaces facing the sweeping light). A prismatic fringe of the
  new token `--figure-sheen-fringe` runs 2.4 band-widths ahead (`u_light[3]`; `u_light` is now `vec3[4]` in both
  shaders). A specular flash: `max(dot(n, normalize(V − WAY)), 0)^32` by five squarings, near the band. An afterglow
  (`trail`) lingers on the most lit surfaces (`smoothstep(0.4, 0.9, lam)`) and fades 1.4 s after the sweep. The
  brightest dots under the band swell (`swell`, size × (1 + 0.7 swell)) and draw as soft points (`v_flare`). Glints
  flare as the band crosses them (+1.2 brightness, × (1 + 0.7) size). The gust's dust takes the band's colour for a
  moment as it leaves (`Gust.tint`, `dusk`).
- Colours (CSS, first pass, untuned): light `--figure-sheen #CF9A2E` (molten gold), core `#FBE3A1`, star `#E6B04A`,
  fringe `#6F7DF2`; dark (both the `[data-theme="dark"]` block and the `prefers-color-scheme` block) gold `#F2B544`,
  white-hot core `#FFFFFF`, star `#FFE1A0`, fringe `#8F8CFF`; Gear Two molten ember `#FF7A2E`, core `#FFE1C2`, star
  `#FFB273`, fringe `#FF3D7A`; Tide cyan `#45D4FF`, core `#EAFCFF`, star `#9FEAFF`, fringe `#B07CFF`. Note Gear Two's
  embers use `--trail-hot: var(--figure-sheen-core)`, so they changed too; check them.

**What you must do:**
1. Rebase `shine-wip` onto `main` (or cherry-pick it), run `tools/qa/shadercheck.mjs`, `npm test`, then **film** each
   mode: `SEGS=light-turn SECS=6 node tools/qa/reel.mjs out-light` (also `dark-turn`, `gear-turn`, `blue-turn`;
   `light-opening`, `dark-opening` for the opening; `reel.mjs` now takes `SEGS`, `SECS`, `FPS`, `W`, `H`, `ROOT`, and
   seeds `gear`/`blue`). Make contact sheets (every 4th frame) and look at every frame of the band crossing.
2. Judge against the brief's "done": **a deep, surreal light crossing a 3D statue, at a glance**, and restraint (one
   beautiful light, not a show). Things to check and tune, in this order:
   - The band's direction reads as from the upper left to the lower right in every pose (it is fixed in view space; the
     figure turns under it). Its line must visibly bend over the forms (chest, raised arm, wings). If it reads flat,
     raise the depth weight: scale WAY's z component (e.g. `[0.45, −0.6, −1.0]` normalised) so depth matters more.
   - Band width and sharpness (`u_span.z`, the `3.0` / `0.8` leading/trailing factors), the fringe's offset (2.4) and
     width (2.5) and strength (0.75), the flash's power (32) and strength (0.85), the afterglow's reach (0.25) and
     life (1.4 s), the swell (0.7) and flare (0.6). On white paper the band recolours ink dots to gold: the core must not
     be so pale it vanishes into the paper (check `#FBE3A1`; a stronger `#F2C766` may read better).
   - The opening: its first shine (1.4 s, `INTRO.sweep`) must still bring the colours in behind the band (`wake`) and the
     red shine after the switch; film `light-opening` and compare with the previous reel's timing (holds 2 s, shine,
     turn, red with one bolt, red shine, turn, back, ~10.5 s).
   - The gust now blows along `DRIFT` (down and to the right) instead of out of the chest: dust leaves the outline where
     it faces down-right. Keep it calm: fine dust in the figure's own colours (the tint lasts only the first third of
     its life). If the breathing (`g.flow`, now a push along DRIFT) reads as the whole figure shuddering, scale it by
     `near` only, or restore a small radial part.
   - The ring's glyphs: they are stirred along DRIFT as the light passes; check they settle.
   - The paper swap (lights on/off) uses the same band: run the swap test and watch it.
3. **Colour per mode**: decide by eye on each paper (light, dark, Gear Two, Tide). For Tide make two clips, cyan
   (`#45D4FF`, `#EAFCFF`, star `#9FEAFF`, fringe `#B07CFF`) and gold (`#E8B85A`, `#FFF3D6`, star `#FFD98A`, fringe
   `#5ED0FF`), and send both to the owner; ship cyan unless he picks gold. Keep every colour in CSS tokens; add
   `--figure-sheen-fringe` to the design spec's §5 table; the subagent's unit test checks Tide sets every token Gear Two
   sets, so any token you add to one must go to both.
4. **Tests** (they must keep passing; extend them): `u_sheen`'s first value is still the eased progress 0→1, the sweep
   finishes within 8 s of load, never runs backwards, `u_span[3]` (the burst's star chance) stays between 0 and 0.05,
   `u_flow[0]` is 0.14 on light paper and less in Gear Two, nothing under reduced motion (`u_sheen` all zeros). Add an
   e2e check that `u_way` is a unit vector pointing right, down, and away (x > 0, y < 0, z < 0) in every mode and that
   `u_wayk.x > 0`, and a unit test for `sheenWay`/`wayAt`: the corner nearest the upper left in front maps to about
   `WAY_MARGIN / (1 + 2 · WAY_MARGIN)`, the far lower-right corner to about `(1 + WAY_MARGIN) / (1 + 2 · WAY_MARGIN)`, and
   both stay so as the figure turns (yaw ±0.3).
5. **Performance**: the shine replaced the old band, so cost should be similar; measure `fps.mjs` (light ≥ 16.3, dark ≥
   19.8 at 1280 × 800) and `margins.mjs` on two cores (touch ≥ 0.09, ring ≥ 1.5). If you need frames, §5 trap 7.
6. The hold frame must not change (no sheen in the hold stage): the hashes in §1 must match. Push. Send him the clips
   (light, dark, red, both Tide variants), then continue without waiting.

**Done when** a clip of the shine on light, dark, red, and Tide reads at a glance as a deep, surreal light crossing a 3D
statue from the upper left, and he says it has the wow factor.

### Step 7, engine side. Tide's own entrance and rhythm in the figure

The page side is live (§2). The figure in Tide today is simply "dark paper with blue tokens": the light map, full tint,
no bank, sky stars on, ordinary sway, no entrance of its own. Build:

1. **Know the mode.** `readColors()` already has `blue` (`data-gear="blue"`). Go through every use of `colors.gear` and
   `colors.dark` in `js/hero.js` and decide what Tide does: no heartbeat (`beat` stays 0), no tears (the tear scheduler
   checks `gear`), no glitch (`onTheme` sets `glitchUntil` only for `flash`/`glitch` phases: keep it so, never for
   `surge`/`ebb`), sway rate 1 (calm), sky stars on and **brighter** (`u_sky` up to about 1.5 in Tide; clamp the
   glint's final brightness), the cloud bank hidden (`u_bank` 0), `tintFor` 1 (the champagne gold is designed for full
   tint; check it reads as metal, not grey).
2. **The entrance** (about 1.2 s, during `data-phase="surge"`, which starts on click; the palette turns ~120 ms later
   inside a View Transition that floods out from the control, so the hero's own canvas is live inside the circle): the
   dots lift off into a slow blue vortex around the body's vertical axis and settle back as the palette turns. The
   assembly already lerps from a shell (`k`, `u_build`); add a uniform `u_vortex` (0 → 1 → 0 over ~1.1 s on
   `--ease-in-out`, set in JS when `data-phase` becomes `surge`) that, per dot, rotates `p` about the y axis through the
   pivot by `u_vortex · (0.6 + 0.8 · s1) · π` with a little lift (`p.y += 0.04 · u_vortex · s2`) and a pull towards the
   axis that grows with distance, so the figure swirls without losing its shape at the ends. Keep it deterministic (hash
   per dot, no `Math.random`). As it settles (at ~0.7 s) start a sheen (`shine(now, 1, SHEEN_SWEEP, false, …)`) so the
   step 5 light sweeps through the blue figure. **Leaving Tide** (`ebb`, 300 ms then a 300 ms cross-fade): quicker and
   quieter, no vortex; just let the palette return (the ink eases over 320 ms already).
3. **While on**: instead of the heartbeat, the tide: every `TIDE = 4.5` s (phase from `performance.now()`, the same
   clock `--tide-delay` uses: `-((performance.now() / 1000) % 4.5)` was written on the root when Tide turned on) a soft
   band of light rises through the figure from the base to the caduceus (use the figure's own y: `tide = smoothstep`
   around `(1 − a_p.y)` against the tide's progress), in `--figure-sheen` at low strength (0.3–0.4), with the dots it
   passes swelling by ~10%. No tears, no lightning. The step 5 sheens still run at the turns of the sway.
4. **Tests**: e2e that in Tide `u_beat` stays 0, `u_glitch` stays 0 through the switch and for 6 s after (no tears),
   `u_vortex` rises above 0.5 and returns to 0 within 1.6 s of the click, and none of it under reduced motion (instant
   switch, `u_vortex` 0); the opening never visits Tide (already tested); hold frame unchanged.
5. Film the entrance from light paper and from Gear Two (`tools/qa/shots.mjs video` records real time; the figure runs
   at a few fps under SwiftShader, so for the owner's clip use virtual time: copy the stepping harness from `reel.mjs`
   and click the Tide control between steps). Send it to him.

**Done when** he can switch to Tide and the entrance and the mode feel stunning and premium to him, and every test is
green.

### Step 6. Dots that flow; a figure that feels alive

**He said:** "The dots are not flowing whatsoever. The avatar should look and feel real; it's only moving a very
little. I need something that adds realism, like the red version." Read next-4 §3 step 6 for the full brief. Concrete
plan for this engine:

1. **Part labels in the vertex.** In `shape()`, write each dot's part (`partOf(relief.data, nearest pixel)`, 0–7) into
   byte 29 (`a_e.y`, read as `int(a_e.y * 255.0 + 0.5)`). Outline points get their part too (in `edges()`, push the part
   number with each point, or look it up from the point's position). The e2e probe's `bufferData` hash will change
   (expected); keep geometry deterministic.
2. **Pivots** (add to `hero.json` as `joints`, figure units, measured on the avatar with a grid overlay; the previous
   agent's estimates, verify them): the big wing's root at the shoulder blade about (0.40, 0.56); the caduceus's small
   wings about the staff's top (0.235, 0.12); the head about the neck (0.50, 0.53); the chest's breathing centre is
   `core` (0.52, 0.63). Validate `joints` in the metadata check like `features`.
3. **Motion, each on its own, filmed, then together** (all amplitudes are starting points; the detail must win):
   - Breathing: scale about `core` by 0.5–1% on a 4.5 s cycle for the torso and head (labels torso, head), the arms
     following at half (they hang from the shoulders).
   - The wing opens and closes about its root: a rotation in the image plane and a little in depth, tips moving 1–2% of
     the figure's width, 6–8 s, phase-offset from the breathing. The caduceus's small wings flutter a little faster
     (about 5 s, ±0.6°), their two halves mirrored.
   - The curls (head part and gold material) sway by up to 0.5% of the width with the breeze (`u_wind`).
   - The snakes (caduceus part below the fist) undulate: a sideways offset `sin(t · 1.3 − y · 18)` of ~0.3% of the
     width, the phase running up the staff. The raised arm and the fist hold still (they carry the caduceus).
   - Compute each part's small transform in JS once a frame and pass `u_parts[8]` (vec4: angle, scale, dx, dy) plus
     the pivots `u_joints[8]` (vec2); the shader picks by label. A few multiply-adds per dot; no loops, no `pow`.
   - Flowing light over the surface: slow currents of brightness along a flow field (`0.5 + 0.5 sin(dot(a_p.xy,
     dir_i) · f_i + t · w_i)` summed over 2–3 terms, in the figure's own coordinates), strength 6–10% of brightness at
     rest and double while a sheen passes; and a few dots (hash < 0.03) riding them along closed loops a pixel or two
     long (`flow += vec2(cos, sin)(t · 0.8 + s1 · τ) · 1.2 px`), so the surface shimmers like flowing sand. This is the
     "dots flowing" he asked for.
   - A moving key light: the light direction drifts by ±4° over ~25 s (`LIGHT` becomes a uniform `u_key`, rotated in
     JS; the shader's `lam` and the sheen's WAY use it; keep WAY fixed or let it follow, decide by eye).
   - Keep the existing drift (`fadeAway`), breeze, and dust, but make them smaller and coherent (the drift distance
     0.006–0.014 of the width can halve) so the coherent motion reads as the life, not the noise.
   - Gear Two keeps its heartbeat and adds the parts' motion; Tide gets the tide (step 7).
4. **Rules**: nothing moves under reduced motion or in the opening's `hold` and `shine` stages; every new uniform is
   constant there (two stills must hash identically); the hold frame must not change (all motion must be zero at
   `t` where the opening holds: gate it like `u_blink` with `live && !still`); `tools/qa/slide.mjs` and the 2x crops at
   the sway's extremes (`tools/qa/poses.mjs` then `tools/qa/crops.py`) must still hold step 2's detail.
5. **Performance** is the hard part (§5 trap 7): measure after each motion; if fps drops under 16.3/19.8, find frames
   first (the ring's text costs ~15% of a frame: cache the fill colour string, skip glyphs fully behind the figure
   earlier; the shader's breeze block and gust loop each cost ~2–3%).
6. **Tests**: unit tests for any pure helper (the parts' transforms per time, `joints` validation); e2e that the new
   uniforms are constant under reduced motion and during the opening's hold, and that the parts' uniform values move in
   full motion.

**Done when** a 10 s idle clip on light and dark paper feels alive and real to him, and step 2's crops still hold.

### Step 8, engine side. The dots under the cursor run ember-hot in Gear Two

The page side (the ember glow and trail) is live. In the vertex shader, where the cursor stirs the dots (`push`,
`within`), in Gear Two only (a uniform `u_ember`, 1 in Gear Two, eased like `u_bank`), set
`hot = max(hot, within * within * u_pointer.z * u_ember * 0.8)` so the dots under the cursor glow in `u_hot`
(white-hot to ember; on dark paper `u_hot` is warm white: consider passing `--trail-ember`'s colour instead for the
cursor's heat). Nothing under reduced motion (`u_pointer.z` is 0 there), nothing on touch (no hover). Check the frame
rate. Film it with the page's embers (`reel.mjs`'s `mouse` segments show how to move the pointer under virtual time).
Ask him whether Tide gets a cool counterpart (the default is no).

### Step 9. Docs, the final reel, the report

- `README.md`: the `js/hero.js` paragraph (the shine, the life, Tide's entrance and tide, the ember-hot dots), the page
  features (the gear shift, Tide), the QA tools list (now also `slide.mjs`, `poses.mjs`, `crops.py`, `stillmatch.py`,
  and `reel.mjs`'s `SEGS`).
- `docs/design-spec.md`: §5 palette (Tide's row with its WCAG ratios is there; add the sheen's colours per mode with the
  fringe), §7 engine (the shine, the parts' motion, the flowing light, the key light), §8 motion (the shine, breathing,
  Tide's entrance, the tide), §9 Gear Two and Tide (the cursor's ember-hot dots), §14 tests.
- `docs/next-4.md` and this file's status lines: what is live, where the build departed from the brief.
- The final reel (`tools/qa/reel.mjs` with `SEGS=light-opening,dark-opening,light-idle,dark-idle,gear-turn,blue-turn,
  light-cursor`, then `ffmpeg -framerate 25 -i out/f%04d.png -vf "scale=720:-2,format=yuv420p" -c:v libx264 -crf 23
  reel.mp4`) and 2x crops beside the avatar (`tools/qa/crops.py`).
- The report: video first, then a few plain lines: what changed, the numbers (dots, fps, data, first-frame time), and
  anything not done or not verified.

---

## 4. Engine map (what changed since next-4 §4)

- **Load** (`mount()`): fetch the dot map for the paper, `depth.webp`, `bluenoise.png`, `hero.json`, `color.webp`;
  `reliefField()` smooths the depth (σ 1.5) inside the figure.
- **`shape()`**: `strokes()` once per dot map (cached on the source), `stipple(…, strokes)`, then `edges()` (parts traced,
  `EDGE_BLUR 1.2`, a point every `EDGE_SPACING 0.75` CSS px) and the clip (dots outside the statue's blurred parts are
  dropped, but in the base), then per dot: depth and normal (`depthNormals`), detail and material (`sampleColors`,
  `materialAt`), the bank flag (the dot's cell threshold against its ink less the bank's share), the outline field;
  then glints, sky stars (outside the figure only), outline points. `shapes[set].banked` counts the bank's own dots;
  `announce()` reports the drawn count.
- **Vertex shader order:** `hidden` (bank) and `edge` flags → assembly from a shell (no `acos`) → rotation → lighting
  (`lam`, `rim` by multiplication) → cursor stir → strike loop → glitch → heartbeat hot dots → material colour (gold lit on
  feather edges, `edgeLit`) → the sheen (on `main`: the old radial band; on `shine-wip`: the sweep) → gusts loop → breeze →
  puffs loop → swap → colour → drift → size/alpha → outline points (fine line, no wind) → glints → hidden dots culled
  out of view.
- **Data pipeline** (`build.py`, ~25 s, deterministic): `maps()` (ink and light maps, the bank's share `own`, the parts
  and the rigid relief, then `feathers()`), `material_map()` (color.webp), `part_codes()` (depth B), `still()` (clipped,
  strokes, outline, `STILL_GAIN`), `sky_stars()`. After any rebuild: `npm run og`, the count in
  `tools/pages/site.json` (`node tools/qa/counts.mjs`, 1440 × 900 light), `node tools/pages/build.mjs`, commit every
  output.

## 5. Traps (new ones first; next-4 §5 still applies)

1. **The first paint.** Any change to the maps, the clip, the outline, or the strokes must keep the still in step:
   `build.py` mirrors the engine (`outline()` = `edges()`, `strokes()` = `strokes()`, the clip, `STILL_GAIN`). After it:
   `holdframe.mjs` with `OUT=` and `tools/qa/stillmatch.py` (block medians within about 1 ± 0.05). A change that is not
   meant to change the figure (the shine, Tide, motion) must leave the hold-frame hashes exactly as before.
2. **New kinds of light must draw nothing before the colours arrive** (`u_tint` is 0 in the opening's hold): multiply by
   the tint, as the glints do. The outline is the exception: it is part of the still.
3. **Reduced motion is one still; two stills must hash identically.** Every new uniform must be constant there.
4. **The probe's contract** (`test/e2e/hero-resilience.test.mjs`): one program, one buffer, one VAO per restoration;
   `bufferData` bytes and hash equal across restorations (no `Math.random` in geometry; page-level effects like the
   embers may use it); uniforms read by name (`u_sheen`, `u_span`, `u_flow`, `u_swap`, `u_tint`, `u_bank`, …): keep their
   meanings. The probe counts fine dots (byte 30), glints (31), and outline points (32) in uploads.
5. **SwiftShader runs every branch and every loop body at least once**: cost is total code × vertices. The vertex shader
   is ~60% of a frame, the ring's 2D text ~15%. Never add a fixed-length loop; loop to a uniform count of live things.
6. **Timing tests depend on frame rate** (touch drag yaw > 0.06 in 850 ms; ring brightening ratio; the opening's hold
   1.9–4 s; off-screen figure not drawn). Run `taskset -c 0,1 node tools/qa/margins.mjs` before pushing anything that
   costs frames. Never run fps, films, or reels while the e2e suite runs.
7. **Finding frames**: the ring's `drawRing` sets `fillStyle` to a new `rgb(...)` string per glyph and transforms per
   glyph; cache the colour string when unchanged; skip back glyphs hidden by the figure before transforming. In the
   shader, the breeze block and the gust loop are the biggest optional chunks. Profile with `fps.mjs`'s `SUBS` (replace
   a block's `if (...)` with `if (false)` to measure its cost) and `NORING=1`.
8. **The bank**: dots flagged in `a_e.x` are moved out of view while the bank is hidden (`hidden > 0.999`); any new
   effect must respect `hidden` (no dust, no light from hidden dots).
9. **Part codes** live in the depth map's blue inside the figure: anything reading that channel as stars must check
   `R == 0` (`skyStars()` does; the e2e sky test does).
10. **`pkill -f` matches its own shell**: `pkill -f chrome` from a bash command whose text contains "chrome" kills that
    shell. Stop stray browsers by PID instead.
11. **`build.py` must reproduce `assets/hero` byte for byte** before you change it (it does at `3d2f8dc`); a different
    Pillow or libwebp would change sizes and the budget.
12. **Gear Two's and Tide's tokens must stay in step**: a unit test checks Tide sets every token Gear Two sets
    (`test/theme.test.cjs`); a new `--figure-*` token goes to every mode block (light `:root`, `[data-theme="dark"]`,
    the `prefers-color-scheme: dark` block, Gear Two, Tide).
13. **The opening** never visits Tide, ends on any press, key, or wheel, never saves a gear, and leaves a gear chosen by
    hand alone.
14. **Transient gear switches no longer touch the session** (the opening's red and back): a gear chosen by hand stays
    saved; do not regress this.

## 6. QA tools and commands

```sh
node tools/qa/shadercheck.mjs                        # compile both shaders, reject reserved words
for s in light dark; do SCHEME=$s OUT=/tmp/hold-$s.raw node tools/qa/holdframe.mjs; done && ~/hero-venv/bin/python tools/qa/stillmatch.py
RUNS=2 node tools/qa/fps.mjs                         # SCHEMES=light,dark,gear; SUBS='[["a","b"]]' rewrites shaders; NORING=1
taskset -c 0,1 node tools/qa/margins.mjs
node tools/qa/slide.mjs                              # ROOT=<worktree> to compare
node tools/qa/poses.mjs out/ light 1 && ~/hero-venv/bin/python tools/qa/crops.py out/ crops.png rest,sway-minus,sway-plus
#   (columns may come from other runs: before/:sway-plus,after/:sway-plus; FEATS=face,fist,cad-top,wing-big,chest,open hand)
SEGS=light-turn,dark-turn SECS=6 node tools/qa/reel.mjs out/   # segments: light-opening dark-opening light-turn dark-turn
#   gear-turn blue-turn light-idle dark-idle light-cursor; then ffmpeg as in step 9
node tools/qa/counts.mjs
CLIP=x,y,w,h node tools/qa/shots.mjs shot / 1440 900 <light|dark|gear> out.png 0 1   # reduced-motion still, cropped
git worktree add /tmp/base <commit>                  # compare against an older commit (ROOT=/tmp/base)
```

A quick look at the wings, the caduceus, and the base in all modes: three reduced-motion shots
(`shots.mjs shot / 1440 900 <mode> … 0 1`), crop (440,300)-(690,550), (450,45)-(660,255), (560,575)-(790,805), and
enlarge 2x nearest. At 1440 × 900 the figure's frame is left 371.5, top 50.6, 757.8 px per figure unit.

## 7. Definition of done, and how to report

1. Steps 5, 7 (engine side), 6, 8 (engine side), and 9 are live on `main`, each its own commit, CI green after each.
2. New behaviour has tests (unit for pure helpers, probe-based e2e where observable).
3. `README.md`, `docs/design-spec.md`, and the status lines of `next-4.md` and this file describe what is live.
4. Each report to the owner leads with a short video (the shine in every mode, Tide's entrance, an idle clip of the
   living figure, the red cursor) and 2x crops beside the avatar, then a few plain lines with the numbers and anything not
   done or not verified.

## 8. The owner's taste (from every handoff; do not reopen)

- Calm, premium, controlled; restraint over effects; one beautiful light, not a show.
- No lightning by hand, ever; one bolt only in the opening's automatic switch to red.
- No glow drawn on the page beside the figure. Dust stays fine, in the figure's own colours, fading into the paper.
- Dots never blink; they drift and flow. No stars in the hair or on the hands.
- The ring of words, its halo, and its gold light stay. The opening's choreography and timing stay.
- He judges by eye and often changes direction after seeing a result: show early, then polish.
