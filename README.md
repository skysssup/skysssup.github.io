# skysssup.github.io

Source for [skysssup.github.io](https://skysssup.github.io/), the staging home of aakashdahal.fun. Plain HTML, CSS, and JavaScript with no build step; every asset is served from this repository.

- **Home** (`index.html`): the GitHub avatar as a slowly turning 3D relief of black stipple dots. Blue words wrap whatever part of the figure faces the viewer, the dots blink, scatter from the cursor, and ripple on click. A closer crop below blinks as an ordered dither. The core threads filter the project list.
- **Portfolio** (`portfolio/`): the arch mark from aakashdahal.fun as a 3D solid built from every project name, dissolving and reassembling on a loop, with an index and a card per project. Private repositories are listed without links.
- **Gear Two**: the header button flashes, glitches, and settles into a red mode with a heartbeat and embers rising off the figure.
- **Lights**: the switch on the right edge saves the light/dark choice in `localStorage` and reveals the new theme with a soft circle from the switch.
- **Extras**: eased scrolling (Lenis 1.3.26, vendored), and a small pixel cat that chases the cursor, naps when idle, and scratches the wall when the cursor leaves the window.

Reduced-motion preferences turn every animation into a still frame, and canvases pause while off-screen or in a background tab.

Serve the folder with any static file server, for example `python3 -m http.server 8080`, then open `http://localhost:8080`. Canvas effects read the avatar image, so they need HTTP rather than `file://`.

Tests use Node.js 22 or later and have no dependencies:

```sh
node --test test/*.test.cjs
```

Space Grotesk is distributed under the bundled OFL license in `assets/fonts/`; Lenis under the bundled MIT license in `assets/vendor/`.
