# skysssup.github.io

Source for [skysssup.github.io](https://skysssup.github.io/). Plain HTML, CSS, and JavaScript, with a luffy.sh-inspired blueprint layout and Aakash Dahal’s original mark and portrait from aakashdahal.fun. All assets are local; no build step or external runtime requests.

The mark assembles from animated text, dissolves, and reappears. Click it to replay, choose Gear Two for a stronger scatter effect, or pause motion. The site respects reduced-motion preferences and suspends canvas rendering when off-screen or in a hidden tab. The light/dark choice is saved in `localStorage`.

Gear Two adds a dark/red palette, a short flash/glitch/settle transition, scan lines, and chromatic separation. A side-mounted light switch reveals the next theme with a circular View Transition, falling back to a normal toggle in older browsers. Scrolling uses locally vendored Lenis 1.3.26 with a subtle spring at the page boundaries; touch scrolling remains native. Motion can be paused globally, and reduced-motion preferences disable these effects.

Space Grotesk is distributed under its bundled OFL license. Lenis is distributed under its bundled MIT license in `assets/vendor/`.

This repository is the staging source. No custom domain or DNS configuration is included; publishing to aakashdahal.fun is a separate step. Biographical content and project links belong to Aakash, rather than copying the reference owner’s employment history.

Serve the folder with any static file server, for example `python3 -m http.server 8080`, then open `http://localhost:8080`. Serving over HTTP allows the canvas to sample the local logo image.

The theme, Gear Two, motion preferences, light switch fallback, and about panel have a small test suite (Node.js 22 or later, no dependencies):

```sh
node --test test/*.test.cjs
```
