# Portfolio motion and interaction

The homepage keeps the main avatar large and animated. `noPointer` disables pointer-driven displacement and touch dragging without disabling the renderer's ambient movement. Reduced motion still draws a static portrait. The avatar is never shrunk into the project sidebar. Pixel density is capped at 1.5 for the homepage renderer. Direct Red and Blue controls restore vivid particle materials, cloud motion, red heartbeat highlights, and blue tide lighting. The repeated bright sweep stays disabled. Pointer-driven deformation and mode-entry vortex deformation remain disabled.

## Composition

- Same-page anchors have one scroll owner: the default browser jump is prevented while Lenis moves the page. This avoids a late native jump fighting the animated destination. Skip links still move keyboard focus.

- A brief black-hole transition opens the homepage automatically. Any input dismisses it. Deep links and reduced motion skip it.
- `scroll-field.js` draws fine contour margins and registration ticks. Scroll position moves the drawing; project selection eases its relief. It does not react to pointer movement or run an idle loop. Hidden tabs and reduced motion suspend it.
- `workbench.js` connects the project wheel, explanatory scene, project copy, category, count, and input drawing. Wheel input uses an analytic critically damped spring; the displayed article follows the nearest visible card during a gesture. Direct input cancels pending wheel snapping. The focus notch shifts gently near either end so the first and last cards do not leave half the wheel empty. Fine travelling ticks and project-specific vector marks share its actual position. It snaps after a gesture and releases page scrolling at both ends. Mouse/pen dragging commits the final selection; it does not trigger a subsequent button click. Touch uses a native horizontal scroll rail, and the nearest item becomes selected when scrolling settles.
- Arrow keys, Home, and End move selection. Previous/next buttons and ordinary buttons provide equivalent input. Only the selected project article is interactive; other articles are inert. A fine orthogonal connector follows the selected wheel item into its scene, without covering the copy. It projects cached geometry, avoiding forced layout on each animation frame. Scene frames use corner marks instead of scanlines. Every project retains a direct case-study link. Without JavaScript, those links remain available and project-pick buttons stay disabled.
- Header controls use native buttons with names and pressed states. Direct Red and Blue buttons affect the avatar and the drawing accents while the page stays black. Pressing an engaged mode returns to the original avatar. The light theme still requires an explicit choice. The header and footer contain no visible name, year, Gear label, source row, or back-to-top row. Contact gives the email address the strongest hierarchy and retains clipboard feedback and selectable-text fallback.

## Living drawing

`js/presence.js` draws branching filaments around the full-size portrait, a projected topology beside it, a living project-wheel spine, and an input drawing beneath the work surface. Scroll, selection, pointer movement, and actual key presses affect the drawing. Its fixed topology is computed once. The drawing runs at 30 fps only while visible, pauses in hidden tabs, and restores full canvas dimensions after reduced motion is switched off. Its animation clock pauses with the page. These are decorative drawings; no fabricated metrics or time widgets are presented.

The SVG work scenes now sit on an open drawing surface rather than a boxed card. Existing illustration labels and public source links remain.

## Graphics and content

The eight original vector scenes live in `tools/pages/scenes.mjs`. They illustrate published project capabilities. They are labeled as illustrations and do not claim to be product recordings, measured traces, or live metrics. Actual recordings remain on individual project pages. Unwritten case studies contain concise project notes instead of invented design narratives.

The reference is [hancore.dev](https://hancore.dev/site/#about): coherent selection motion, fine drawing detail, restrained colors, and coupled input feedback. No reference artwork or source code is included.

## Editing and verification

Edit the generator and source modules, then run `node tools/pages/build.mjs`. Shared header, contact, and footer changes are generated; do not edit their output pages by hand. The new presentation rules are in `css/craft.css`, after the base and earlier polish layers.

Run `npm test` and the targeted browser checks in `blackhole.test.mjs`, `polish.test.mjs`, `work-stage.test.mjs`, and `explore.test.mjs`. The browser checks cover wheel boundaries, reversals, dragging, scene reset, idle frame shutdown, keyboard navigation, reduced motion, clipboard fallback, JavaScript-disabled navigation, and layouts down to 304 px. Set `CRAFT_SHOTS` to save visual evidence.
