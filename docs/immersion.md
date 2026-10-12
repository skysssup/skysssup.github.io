# Portfolio motion and interaction

The homepage keeps the main avatar large and animated. `noPointer` disables pointer-driven displacement and touch dragging without disabling the renderer's ambient movement. Reduced motion still draws a static portrait. The avatar is never shrunk into the project sidebar.

## Composition

- A brief black-hole transition opens the homepage automatically. Any input dismisses it. Deep links and reduced motion skip it.
- `scroll-field.js` draws two projected ink ribbons and a sparse star field behind the content. Scroll position changes their phase; scroll momentum and pointer position give them a small displacement. Its frame loop stops once those inputs settle, stops in hidden tabs, and is disabled under reduced motion. The native pointer remains visible.
- `workbench.js` connects the project wheel, explanatory scene, project copy, category, count, and input compass. Wheel input uses an analytic critically damped spring. It snaps after a gesture and releases page scrolling at both ends. Mouse/pen dragging commits the final selection; it does not trigger a subsequent button click. Touch uses a native horizontal scroll rail, and the nearest item becomes selected when scrolling settles.
- Arrow keys, Home, and End move selection. Previous/next buttons and ordinary buttons provide equivalent input. Only the selected project article is interactive; other articles are inert. Every project retains a direct case-study link. Without JavaScript, those links remain available and project-pick buttons stay disabled.
- Header controls use native buttons with names and pressed states. The light theme requires an explicit choice. The header and footer contain no visible name, year, Gear label, source row, or back-to-top row. Contact gives the email address the strongest hierarchy and retains clipboard feedback and selectable-text fallback.

## Graphics and content

The eight original vector scenes live in `tools/pages/scenes.mjs`. They illustrate published project capabilities. They are labeled as illustrations and do not claim to be product recordings, measured traces, or live metrics. Actual recordings remain on individual project pages. Unwritten case studies contain concise project notes instead of invented design narratives.

The reference is [hancore.dev](https://hancore.dev/site/#about): coherent selection motion, fine drawing detail, restrained colors, and coupled input feedback. No reference artwork or source code is included.

## Editing and verification

Edit the generator and source modules, then run `node tools/pages/build.mjs`. Shared header, contact, and footer changes are generated; do not edit their output pages by hand. The new presentation rules are in `css/craft.css`, after the base and earlier polish layers.

Run `npm test` and the targeted browser checks in `blackhole.test.mjs`, `polish.test.mjs`, `work-stage.test.mjs`, and `explore.test.mjs`. The browser checks cover wheel boundaries, reversals, dragging, scene reset, idle frame shutdown, keyboard navigation, reduced motion, clipboard fallback, JavaScript-disabled navigation, and layouts down to 304 px. Set `CRAFT_SHOTS` to save visual evidence.
