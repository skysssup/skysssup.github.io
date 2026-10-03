# skysssup.github.io

Source for [skysssup.github.io](https://skysssup.github.io/), the staging home of aakashdahal.fun. Plain HTML, CSS, and JavaScript with no build step; every asset is served from this repository.

- **Home** (`index.html`): the GitHub avatar rendered as a field of dithered dots that fly in, blink, scatter away from the cursor, and ripple on click, with project words scrolling through the bright parts of the image and glitch tiles that reveal the original pixels. A second, closer crop below blinks like an ordered dither.
- **Portfolio** (`portfolio/`): the arch mark from aakashdahal.fun, built from the names of every project, which dissolves and reassembles on a loop, plus a card for each project. Private repositories are listed without links.
- **Gear Two**: the header button flashes, glitches, and settles into a red mode with a heartbeat, chromatic headings, and rising glyphs.
- **Lights**: the switch on the right edge saves the light/dark choice in `localStorage` and reveals the new theme with a soft circle from the switch.
- **Extras**: eased scrolling (Lenis 1.3.26, vendored), and a small pixel cat that chases the cursor, naps when idle, and scratches the wall when the cursor leaves the window.

Reduced-motion preferences turn every animation into a still frame, and canvases pause while off-screen or in a background tab.

Serve the folder with any static file server, for example `python3 -m http.server 8080`, then open `http://localhost:8080`. Canvas effects read the avatar image, so they need HTTP rather than `file://`.

Tests use Node.js 22 or later and have no dependencies:

```sh
node --test test/*.test.cjs
```

Space Grotesk is distributed under the bundled OFL license in `assets/fonts/`; Lenis under the bundled MIT license in `assets/vendor/`.
