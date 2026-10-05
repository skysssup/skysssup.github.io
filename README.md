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
next pass on the hero (sheen and sparkle bursts, face and hand detail, the ring's line, the palette) is
[docs/next-2.md](docs/next-2.md); the visual QA helper it uses is `tools/qa/shots.mjs`.

## How it works

- `css/site.css` — tokens for light, dark, and Gear Two (including the figure's material palette and sheen); the
  sheet grid; every component; the Gear Two choreography (flash, shockwave ring, text split, media slices, settle)
  and its heartbeat keyframes.
- `js/theme.js` — the light switch: saved choice, OS sync, cross-tab sync.
- `js/motion.js` — the site-wide reduced-motion setting (OS or the footer toggle), Gear Two's flash → glitch → settle
  with the red ring that leaves the switch and the `--beat-delay` that phases every CSS pulse to the hero's 0.9 s
  heartbeat, the circle theme reveal (View Transitions), Lenis smooth scrolling, cross-page transitions.
  `switchGear(on, origin, transient)` runs the sequence towards a state; the hero's opening uses it to go to Gear Two
  and back without saving it to the session.
- `js/hero.js` — the avatar as a WebGL2 stipple sculpture wrapped in a ring that carries one line in the statue's
  voice (`ringLine` in `tools/pages/site.json`; hovering a theme brightens it for 400 ms). It stipples
  `assets/hero/ink.webp` (896 px) against a blue-noise tile at load (the face and both hands on a grid twice as fine,
  with half-size dots, on screens of 1.5 device pixels per CSS pixel or more; the zones are `fine` in
  `assets/hero/hero.json`), takes each dot's depth, surface normal, distance to the figure's edge, and detail from
  `assets/hero/depth.webp` (the depth smoothed inside the figure first, so the lighting never bands), and its material
  from `assets/hero/color.webp` (gold, marble, cloud, lightning, or glint), colored from a palette designed per mode
  in `css/site.css` that moves each material from its base to its lit color as the figure turns (marble stays ink; the
  map's alpha carries the image's sparkles, which twinkle). Sway, lighting, blinking, cursor push, click ripples, and
  Gear Two all run in the vertex shader. At each turn of the sway a band of light crosses the figure and a burst of
  dots flares into four-point stars, in blue on light paper, cyan on dark, and warm white in Gear Two; a few dots
  leave the surface as the band passes, stream on behind it as bits, and turn to eight-point crystals where they reach
  the figure's edge, then re-form in place. On light and dark paper the shine is stronger: a wider band with an
  afterglow, more stars, and a glow on the paper behind the figure. Opening the page plays an opening once a tab
  (again on a reload, never under reduced motion): the figure holds still in its ink for a moment, a slower shine
  crosses it and leaves its colors behind, it turns once and comes back, the page goes to Gear Two with the shockwave
  leaving the figure, a red shine crosses it as it turns once more, and the page comes back; Gear Two is never saved
  for the next page, and any press, key, or scroll ends the opening. In Gear Two the dots turn red, a heartbeat pulses
  their size and sets a few of them white-hot, the ring breathes, and the glitch tears tiles out of the figure with
  two faint afterimages; while Gear Two stays on, about a third of the heartbeats tear it again for a few frames, with
  a longer tear about every 6 s. It pauses off-screen and draws one still frame under reduced motion. A small,
  preloaded `assets/hero/preview.webp` covers startup; without WebGL2 it shows the full-resolution
  `assets/hero/still.webp`. Both masks come from the same stipple render, framed and foreshortened as the engine draws
  the figure facing the viewer, so in the opening the still fades into the first drawn frame in place. Context
  restoration rebuilds GPU resources from cached geometry without fetching the assets again. Horizontal touch drags
  turn the figure without blocking vertical scrolling; the caption's ripple button works by keyboard, and a readout
  under the caption shows yaw, pitch, and the engine's JS time per frame.
- `js/page.js` — local time, copy-to-clipboard with a selectable-email fallback, the searchable site index,
  /work search and views, the sticky case-study section index and reading progress, video play/pause,
  the reveals (`[data-reveal]`: section rules draw in and media wipes in, once, when first seen, never under
  reduced motion), and mounting the hero. Below the hero it also runs the contact dial (my day on a 24-hour face,
  the night stippled in from a sunrise and sunset worked out for the date, a hand for now, and a readout that
  follows the pointer), the plates that develop from a stipple drawing of their own screenshot the first time
  they are seen, the construction grid (`G`: minor columns, insets, and a tag naming the role, size, and line of
  whatever text the pointer rests on), and Gear Two's drafting crosshair. Open the site index from the header, `/`, or `Ctrl/Cmd+K`;
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
npm run test:e2e              # every page at 1440/1280/768/390 in light, dark, and Gear Two:
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
