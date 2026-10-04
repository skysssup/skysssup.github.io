# skysssup.github.io

Aakash Dahal's site, staged here before it moves to aakashdahal.fun. Plain HTML, CSS, and JavaScript served by
GitHub Pages straight from `main`, with no build step. Every asset is in this repository.

## Pages

- `/` — the hero, a short "Essentially" statement, selected work, and contact.
- `/work/` — all projects, filterable by theme (`?theme=ai-systems`, `developer-tools`, `physics-software`) and searchable by name, technology, or theme (`?q=python`). List/grid preference is saved locally; filters and search are shareable and follow browser history.
- `/work/<slug>/` — one case study per project. See [docs/case-studies.md](docs/case-studies.md) for how to fill one in.
- `/404.html`, and `/portfolio/`, which forwards old links to `/work/`.

The design rules (grid, type, color, motion) are in [docs/design-spec.md](docs/design-spec.md).

## How it works

- `css/site.css` — tokens for light, dark, and Gear Two; the sheet grid; every component.
- `js/theme.js` — the light switch: saved choice, OS sync, cross-tab sync.
- `js/motion.js` — the site-wide reduced-motion setting (OS or the footer toggle), Gear Two's flash → glitch → settle,
  the circle theme reveal (View Transitions), Lenis smooth scrolling, cross-page transitions.
- `js/hero.js` — the avatar as a WebGL2 stipple sculpture wrapped in a ring of project names. It stipples
  `assets/hero/data.png` (depth, ink, mask) against a blue-noise tile at load, then animates sway, blinking,
  cursor push, click ripples, and Gear Two entirely in the vertex shader. It pauses off-screen and draws one still
  frame under reduced motion. A small, preloaded `assets/hero/preview.webp` covers startup; without WebGL2 it
  shows the full-resolution `assets/hero/still.webp`. Both masks come from the same stipple render. Context
  restoration rebuilds GPU resources from cached geometry without fetching the assets again. Horizontal
  touch drags turn the figure without blocking vertical scrolling; the caption's ripple button works by keyboard.
- `js/page.js` — Kathmandu time, copy-to-clipboard with a selectable-email fallback, the searchable site index,
  /work search and views, the sticky case-study section index and reading progress, video play/pause,
  and mounting the hero and the cat (`js/cat.js`). Open the site index from the header, `/`, or `Ctrl/Cmd+K`;
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
- Hero data: `python3 tools/hero/build.py` (needs numpy and Pillow). The depth map is cached in
  `tools/hero/depth.png`; `--depth` regenerates it with Depth Anything V2 Small (needs torch and transformers).

## Moving to aakashdahal.fun

Canonical, share, and sitemap URLs use `https://skysssup.github.io`. To move, change `origin` in
`tools/pages/site.json`, run `node tools/pages/build.mjs` (pages, `sitemap.xml`, `robots.txt`) and `npm run og`
(share images print the host), set `ORIGIN` in `test/content.test.cjs`, then run `npm test`.
