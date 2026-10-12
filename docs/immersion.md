# Portfolio motion and interaction

The homepage keeps the main avatar large and animated. `noPointer` disables pointer-driven displacement and touch dragging without disabling the renderer's ambient movement. Reduced motion still draws a static portrait. The avatar is never shrunk into the project sidebar. Its matte finish removes periodic shine sweeps, silk washes, red heartbeat flashes, and mode-entry deformation while preserving ambient sway and the original anatomy.

## Composition

- A brief black-hole transition opens the homepage automatically. Any input dismisses it. Deep links and reduced motion skip it.
- `scroll-field.js` draws fine contour margins and registration ticks. Scroll position moves the drawing; project selection eases its relief. It does not react to pointer movement or run an idle loop. Hidden tabs and reduced motion suspend it.
- `workbench.js` connects the project wheel, explanatory scene, project copy, category, count, and input compass. Wheel input uses an analytic critically damped spring; the displayed article follows the nearest visible card during a gesture. Direct input cancels pending wheel snapping. The focus notch shifts gently near either end so the first and last cards do not leave half the wheel empty. Fine travelling ticks and project-specific vector marks share its actual position. It snaps after a gesture and releases page scrolling at both ends. Mouse/pen dragging commits the final selection; it does not trigger a subsequent button click. Touch uses a native horizontal scroll rail, and the nearest item becomes selected when scrolling settles.
- Arrow keys, Home, and End move selection. Previous/next buttons and ordinary buttons provide equivalent input. Only the selected project article is interactive; other articles are inert. A fine orthogonal connector follows the selected wheel item into its scene, without covering the copy. Scene frames use corner marks instead of scanlines. Every project retains a direct case-study link. Without JavaScript, those links remain available and project-pick buttons stay disabled.
- Header controls use native buttons with names and pressed states. A keyboard-accessible palette disclosure offers Stone, Rose, and Blue at every screen width. Color and light choices are independent. Escape closes the disclosure and returns focus; clicking or focusing elsewhere also closes it. The light theme requires an explicit choice. The header and footer contain no visible name, year, Gear label, source row, or back-to-top row. Contact gives the email address the strongest hierarchy and retains clipboard feedback and selectable-text fallback.

## Graphics and content

The eight original vector scenes live in `tools/pages/scenes.mjs`. They illustrate published project capabilities. They are labeled as illustrations and do not claim to be product recordings, measured traces, or live metrics. Actual recordings remain on individual project pages. Unwritten case studies contain concise project notes instead of invented design narratives.

The reference is [hancore.dev](https://hancore.dev/site/#about): coherent selection motion, fine drawing detail, restrained colors, and coupled input feedback. No reference artwork or source code is included.

## Editing and verification

Edit the generator and source modules, then run `node tools/pages/build.mjs`. Shared header, contact, and footer changes are generated; do not edit their output pages by hand. The new presentation rules are in `css/craft.css`, after the base and earlier polish layers.

Run `npm test` and the targeted browser checks in `blackhole.test.mjs`, `polish.test.mjs`, `work-stage.test.mjs`, and `explore.test.mjs`. The browser checks cover wheel boundaries, reversals, dragging, scene reset, idle frame shutdown, keyboard navigation, reduced motion, clipboard fallback, JavaScript-disabled navigation, and layouts down to 304 px. Set `CRAFT_SHOTS` to save visual evidence.
