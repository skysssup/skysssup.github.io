# skysssup.github.io

Aakash Dahal's site, staged here before it moves to aakashdahal.fun. Plain HTML, CSS, and JavaScript served by
GitHub Pages straight from `main`, with no build step. Every asset is in this repository.

## Pages

- `/` — the hero, a short "Essentially" statement, selected work, the stack matrix (technologies × projects,
  read from the project data), a colophon with the site's own numbers, and contact.
- `/work/` — all projects, filterable by theme (`?theme=ai-systems`, `developer-tools`, `physics-software`) and searchable by name, technology, or theme (`?q=python`). List/grid preference is saved locally; filters and search are shareable and follow browser history.
- `/work/<slug>/` — one case study per project. See [docs/case-studies.md](docs/case-studies.md) for how to fill one in.
- `/404.html`, and `/portfolio/`, which forwards old links to `/work/`.

The design rules (grid, type, color, motion) are in [docs/design-spec.md](docs/design-spec.md). The brief for the
next pass on the hero (sheen and sparkle bursts, face and hand detail, the ring's line, the palette) is
[docs/next-2.md](docs/next-2.md); the visual QA helper it uses is `tools/qa/shots.mjs`.

## How it works

- `css/site.css` — tokens for light, dark, and Gear Two; the sheet grid; every component; the Gear Two
  choreography (flash, shockwave ring, text split, media slices, settle) and its heartbeat keyframes.
- `js/theme.js` — the light switch: saved choice, OS sync, cross-tab sync.
- `js/motion.js` — the site-wide reduced-motion setting (OS or the footer toggle), Gear Two's flash → glitch → settle
  with the red ring that leaves the switch and the `--beat-delay` that phases every CSS pulse to the hero's
  0.9 s heartbeat, the circle theme reveal (View Transitions), Lenis smooth scrolling, cross-page transitions.
- `js/hero.js` — the avatar as a WebGL2 stipple sculpture wrapped in a ring that carries one line in the statue's
  voice (`ringLine` in `tools/pages/site.json`; hovering a theme brightens it for 400 ms). It stipples
  `assets/hero/ink.webp` (896 px) against a blue-noise tile at load, takes each dot's depth, surface normal, and
  detail from `assets/hero/depth.webp` (the depth smoothed inside the figure first, so the lighting never bands),
  samples the avatar's color under each dot from `assets/hero/color.webp` (its hue, with
  the brightness set by the paper, so marble stays ink and gold stays gold on light and dark alike; the map's
  alpha carries the image's sparkles, which twinkle), then animates sway, lighting, blinking, cursor push,
  click ripples, and Gear Two entirely in the vertex shader. At each turn of the sway a band of light crosses the
  figure and a burst of dots flares into four-point stars, in blue on light paper, cyan on dark, and warm white in
  Gear Two. In Gear Two the dots turn red, a heartbeat pulses their size and sets a few of them
  white-hot, the ring breathes, and the glitch tears tiles out of the figure with two faint afterimages; while
  Gear Two stays on, about a third of the heartbeats tear it again for a few frames, with a longer tear about
  every 6 s. It
  pauses off-screen and draws one still frame under reduced motion. A small, preloaded `assets/hero/preview.webp`
  covers startup; without WebGL2 it shows the full-resolution `assets/hero/still.webp`. Both masks come from the
  same stipple render. Context restoration rebuilds GPU resources from cached geometry without fetching the
  assets again. Horizontal touch drags turn the figure without blocking vertical scrolling; the caption's ripple
  button works by keyboard, and a readout under the caption shows yaw, pitch, and the engine's JS time per frame.
- `js/page.js` — Kathmandu time, copy-to-clipboard with a selectable-email fallback, the searchable site index,
  /work search and views, the sticky case-study section index and reading progress, video play/pause,
  the reveals (`[data-reveal]`: section rules draw in, media wipes in, the stack matrix's dots pop in, and the
  colophon counts up, once, when first seen, never under reduced motion), the stack matrix's column highlight,
  and mounting the hero. Open the site index from the header, `/`, or `Ctrl/Cmd+K`;
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
  `tools/pages/bodies/`). Commit the regenerated HTML with the change; `npm test` checks they match. The home
  colophon prints numbers the generator measures (test counts, gzipped CSS and JS, font sizes), so changing
  CSS, JS, or tests also means regenerating.
- Share images: `npm run og` (after changing a page title, summary, or cover).
- Hero data: `python3 tools/hero/build.py` (needs numpy and Pillow). Its source, `assets/avatar.jpg`, is the
  424 px GitHub avatar (`tools/hero/avatar-424.jpg`) upscaled 4× by Real-ESRGAN and Real-ESRNet; `--upscale`
  redoes that (torch and spandrel; the weights are fetched and checked against their SHA-256). The depth map is
  cached as 16-bit in `tools/hero/depth.png`; `--depth` regenerates it with Depth Anything V2 Base (torch and
  transformers). `--color` rewrites only `assets/hero/color.webp`.

## Moving to aakashdahal.fun

Canonical, share, and sitemap URLs use `https://skysssup.github.io`. To move, change `origin` in
`tools/pages/site.json`, run `node tools/pages/build.mjs` (pages, `sitemap.xml`, `robots.txt`) and `npm run og`
(share images print the host), set `ORIGIN` in `test/content.test.cjs`, then run `npm test`.
