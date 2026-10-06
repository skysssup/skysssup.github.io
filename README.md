# skysssup.github.io

Aakash Dahal's site, staged here before it moves to aakashdahal.fun. Plain HTML, CSS, and JavaScript served by
GitHub Pages straight from `main`, with no build step. Every asset is in this repository.

## Pages

- `/` — the hero (the intro, and "Why the statue" beside the figure), selected work as four plates that develop
  from stipple drawings, and contact, with my day on a 24-hour dial. Opening the page plays the figure's opening
  (see `js/hero.js` below).
- Every page ends on the same closing line: name, local time, year, three links, and two quiet toggles, Grid
  (the construction grid, also on `G` and in the header) and Reduce motion.
- `/work/` — all projects, filterable by theme (`?theme=ai-systems`, `developer-tools`, `physics-software`) and searchable by name, technology, or theme (`?q=python`). List/grid preference is saved locally; filters and search are shareable and follow browser history.
- `/work/<slug>/` — one case study per project. See [docs/case-studies.md](docs/case-studies.md) for how to fill one in.
- `/404.html`, and `/portfolio/`, which forwards old links to `/work/`.

The design rules (grid, type, color, motion) are in [docs/design-spec.md](docs/design-spec.md). The brief for the
next pass on the hero figure (detail that survives the turn, a clear silhouette, finer wings and caduceus, a deep
one-sided shine in each mode's colour, a figure that breathes and flows, the cloud bank only in red, the stars back,
a blue gear reached by hand with a control that reads as a gear shift, and a new cursor in red) is
[docs/next-4.md](docs/next-4.md), and the brief for the last of it (the shine, a living figure, Tide's own entrance, the red
cursor's dots, the docs; all live now, its status line says where the build departed from it) is
[docs/next-5.md](docs/next-5.md); the earlier ones are `docs/next.md`, `next-2.md`, and `next-3.md`. Its QA tools are
in `tools/qa/`: `shots.mjs` (screenshots, and a `film` mode that plays the opening under virtual time), `reel.mjs` (a
reel of the figure under virtual time for the owner: `SEGS` picks its segments, the openings, a turn in each mode, idle
on light and dark paper, the cursor on white and in Gear Two; `FREEZE=1` pins the figure's turn so a reel shows its
life alone), `fps.mjs`, `holdframe.mjs` (the opening's first frame, hashed, so a change that must not touch the first
paint can be checked bit for bit), `stillmatch.py` (that frame against the still that covers loading, block by block),
`margins.mjs`, `shadercheck.mjs`, `counts.mjs`, `slide.mjs` (how unevenly the dots slide as the figure turns), and
`poses.mjs` with `crops.py` (the figure at rest, mid-turn, and at both extremes, cropped beside the avatar).

## How it works

- `css/site.css` — tokens for light, dark, Gear Two, and Tide (including the figure's material palette and sheen);
  the sheet grid; every component, the gear shift among them; the Gear Two choreography (flash, shockwave ring, text
  split, media slices, settle) and its heartbeat keyframes; Tide's flood of light and its tide.
- `js/theme.js` — the light switch: saved choice, OS sync, cross-tab sync; it reads as lights off in either gear.
- `js/motion.js` — the site-wide reduced-motion setting (OS or the footer toggle), and the gears behind the header's
  gear shift: Gear Two's flash → glitch → settle with the red ring that leaves the switch and the `--beat-delay` that
  phases every CSS pulse to the hero's 0.9 s heartbeat, and Tide (the blue gear, reached only by hand), whose surge
  floods the blue page out from the control behind a ring of light and whose `--tide-delay` phases its pulses to a
  4.5 s tide; the circle theme reveal (View Transitions), Lenis smooth scrolling, cross-page transitions.
  `switchGear(gear, origin, transient)` runs the sequence towards a gear (`"two"`, `"blue"`, or none; `true` and
  `false` still mean Gear Two and none); the hero's opening uses it to go to Gear Two and back without saving it to
  the session.
- `js/hero.js` — the avatar as a WebGL2 stipple sculpture wrapped in a ring that carries one line in the statue's
  voice (`ringLine` in `tools/pages/site.json`; hovering a theme brightens it for 400 ms; a light reads along the line
  once every 7 s, 3.5 s in Gear Two, the glyphs it passes turning gold, ember in Gear Two, and a sheen's wave lifts
  them as it passes). It stipples a map of
  where the dots go against a blue-noise tile at load (the whole figure on a grid twice as fine, with smaller dots in
  the same tone, on screens of 1.5 device pixels per CSS pixel or more), the statue and the bank of clouds it rises
  from, its hollows drawn from a normal map (`tools/hero/normals.png`, Marigold) checked against the avatar. On
  light paper that is `assets/hero/ink.webp` (896 px), dense where the statue is dark, so the dots are ink, as in an
  engraving; on dark paper, Gear Two's included, it is `assets/hero/light.webp`, dense where the statue is lit, so
  the dots are light and the figure reads as a lit statue in a dark room instead of a negative. A page loads only the
  map for the paper it opens on; when the lights or Gear Two change the paper, the other map is fetched, the figure
  dims until it arrives, and a band of light crosses it and swaps the dots behind it (at once under Gear Two's flash
  and glitch, and under reduced motion). It takes each dot's depth, surface normal, distance to the figure's edge, and detail from
  `assets/hero/depth.webp` (laid out as rigid parts, so the figure turns as a solid statue instead of its edges spraying apart, and smoothed inside the figure first, so the lighting never bands), and its material
  from `assets/hero/color.webp` (gold, marble, cloud, lightning, or glint), colored from a palette designed per mode
  in `css/site.css` that moves each material from its base to its lit color as the figure turns (marble stays ink; the
  map's alpha carries the image's sparkles, which twinkle). Once the colors have arrived the ink takes the light as the
  avatar does, a warm key where the stone faces the light and a cool fill where it turns away. The statue has a clear
  edge: each part's outline is traced at load from the parts the depth map's blue names and drawn as a fine line of
  points, ink on white and a soft rim of light on dark, with the stipple clipped to it (the clouds keep their soft fade).
  The wing and the caduceus are drawn in strokes along their feathers and coils, an engraving's hatching, from the
  image's own local contrast. The avatar's own star glints (the round sparkles on its wings, caduceus, rubble, and lightning, found in the color map at load, none
  in the hair or on a hand) twinkle over it as compact optical points, clearly visible and never dominant; on dark paper and in Gear Two the
  stars of the avatar's sky come out around it too, far behind (read from the depth map's blue channel). The cursor stirs the dots like a hand through dust: they
  turn about it in an eddy and are dragged along with it, and a quick sweep across the figure blows off the dots it
  passes. Sway, lighting, the dots' drift, the cursor's stir, and Gear Two all run in the vertex shader. The figure is
  alive: each dot knows which part of the statue it belongs to, and once a frame `life()` works out each part's small
  motion about its joint (`joints` in `assets/hero/hero.json`), so the torso breathes every 4.5 s and the head rides on
  it, the arms follow at half, the big wing opens and closes about its root over 7 s and comes forward a little as it
  lifts, the caduceus's small wings beat either side of the staff, the two snakes sway about a staff that holds still,
  the curls sway with the breeze, and the outstretched arm turns by a hair; slow currents of light flow over the
  whole surface, brightening the stone where they crest and shading its troughs, with the dots riding them a little
  along the wave; and the key light drifts a few degrees over 25 s, as if clouds passed the sun. At each turn of the
  sway a sheen crosses the figure: a sheet of light that sweeps the turned statue from the key light's side, the upper
  left in front, to the lower right behind, through its depth, so the line where it cuts the surface bends over the
  forms and the raised arm and the head catch it before the wing and the chest behind them; the line is bright in each
  mode's own colour (molten gold with a light gold core on white paper, gold with a white-hot core on dark, ember in
  Gear Two, electric cyan in Tide), a warm wash lands behind it on the surfaces facing the light, a thin fringe of a
  complementary hue runs just ahead of it on the stone, surfaces facing it flash, and a few dots twinkle into small
  stars as it passes them. The sheet is a gust of wind blowing its way: every dot it reaches breathes out and back
  with its neighbours, and a few of the dots near the outline lift off as fine dust in their own colours, take the
  light's colour for a moment, drift out slowing and wavering together, and fade into the paper, then grow back in
  place, each at its own moment. Dots never blink: now and then one drifts away on the breeze, fading as it goes, and
  fades back in at home, and between gusts the breeze takes a few dots off the outline, quietly enough to be seen only
  by someone who looks. Gear Two's gust lifts half as much dust. Opening the page plays an opening once a tab (again
  on a reload, never under reduced motion): the figure holds still in its ink for two seconds, a shine sweeps it from
  the upper left and leaves its colors in its wake, it turns once and comes back, the page goes to Gear Two with the
  shockwave leaving the figure and one bolt of lightning striking it (the only lightning there is: nothing calls it
  down by hand), a red shine crosses it as it turns once more, and the page comes back; Gear Two is never saved for the
  next page, and any press, key, or scroll ends the opening. In Gear Two the dots turn red, a heartbeat pulses their
  size and sets a few of them white-hot, the dots under the cursor run ember-hot in a soft glow of their own (white-hot
  at its centre, ember at the edge of its reach), the ring breathes, and the glitch tears tiles out of the figure with
  two faint afterimages; while Gear Two stays on, about a third of the heartbeats tear it again for a few frames, with
  a longer tear about every 6 s. Tide, the blue gear, comes into the figure with an entrance of its own: as the page's
  surge begins the dots lift off into a slow blue vortex round the body's upright axis and settle back as the palette
  turns, a cyan sheen sweeping them as they settle; while Tide is on, a soft band of its light rises through the figure
  every 4.5 s on the page's own clock in place of the heartbeat, the sky's stars shine brighter, and nothing tears. It
  pauses off-screen and draws one still frame under reduced motion (nothing of the life, the sheen, the vortex, the
  tide, or the heat runs there, and the opening's held figure is exactly the still one). A small,
  preloaded `assets/hero/preview.webp` covers startup; without WebGL2 it shows the full-resolution
  `assets/hero/still.webp` (`preview-dark.webp` and `still-dark.webp`, from the light map, on dark paper). Each pair
  comes from the same stipple render as the dots, framed and foreshortened as the engine draws the figure facing the
  viewer, so in the opening the still fades into the first drawn frame in place. Context
  restoration rebuilds GPU resources from cached geometry without fetching the assets again. Horizontal touch drags
  turn the figure without blocking vertical scrolling, and a readout under the caption shows yaw, pitch, and the
  engine's JS time per frame. CI renders with SwiftShader, which runs every branch of a shader whether it is taken or
  not, so the shaders loop only over what is live and share what their shapes can.
- `js/page.js` — local time, copy-to-clipboard with a selectable-email fallback, the searchable site index,
  /work search and views, the sticky case-study section index and reading progress, video play/pause, Gear Two's
  embers (a glow that follows a fine pointer, beating with the heart, and a short trail of embers that rise and fade),
  the reveals (`[data-reveal]`: section rules draw in and media wipes in, once, when first seen, never under
  reduced motion), and mounting the hero. Below the hero it also runs the contact dial (my day on a 24-hour face,
  the night stippled in from a sunrise and sunset worked out for the date, a hand for now, and a readout that
  follows the pointer), the plates that develop from a stipple drawing of their own screenshot the first time
  they are seen, the construction grid (`G`: minor columns, insets, and a tag naming the role, size, and line of
  whatever text the pointer rests on). Open the site index from the header, `/`, or `Ctrl/Cmd+K`;
  use arrow keys to browse, Enter to open, and Escape to close. It uses a native dialog, traps focus,
  restores the opener, and locks background scrolling without changing the saved motion preference.
- `js/diagram.js` — draws case-study diagrams from their JSON specs.

Fonts are Instrument Sans and Fragment Mono (SIL OFL, `assets/fonts/`), subset to Latin with arrows.
Lenis 1.3.26 is vendored under MIT (`assets/vendor/`).

## Run it

```sh
python3 -m http.server 8080   # then open http://localhost:8080
```

## Tests

```sh
npm test                      # unit and content tests, no dependencies needed
npm ci && npx playwright install chrome
npm run test:e2e              # every page at 1440/1280/768/390 in light, dark, Gear Two, and Tide:
                              # console errors, overflow, axe-core, interactions, links
```

CI runs both on every push to `main`.

## Regenerating pages and assets

- Pages: `node tools/pages/build.mjs` after editing `tools/pages/` (site and project data, case-study bodies in
  `tools/pages/bodies/`). Commit the regenerated HTML with the change; `npm test` checks they match.
- Share images: `npm run og` (after changing a page title, summary, or cover).
- Hero data: `python3 tools/hero/build.py` (needs numpy and Pillow). Its source, `assets/avatar.jpg`, is the
  424 px GitHub avatar (`tools/hero/avatar-424.jpg`) upscaled 4× by Real-ESRGAN and Real-ESRNet; `--upscale`
  redoes that (torch and spandrel; the weights are fetched and checked against their SHA-256). The depth map is
  cached as 16-bit in `tools/hero/depth.png`; `--depth` regenerates it with Depth Anything V2 Base (torch and
  transformers). `--color` stops after the material map, `assets/hero/color.webp`.

## Moving to aakashdahal.fun

Canonical, share, and sitemap URLs use `https://skysssup.github.io`. To move, change `origin` in
`tools/pages/site.json`, run `node tools/pages/build.mjs` (pages, `sitemap.xml`, `robots.txt`) and `npm run og`
(share images print the host), set `ORIGIN` in `test/content.test.cjs`, then run `npm test`.
