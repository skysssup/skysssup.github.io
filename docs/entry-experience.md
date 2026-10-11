# Portfolio entrance

The home page opens with a procedural wire caduceus and a source excerpt drawn from `spring()` in `js/hero.js`. Enter, the button, or Escape opens the portfolio. The entrance plays once per tab; Replay entry or `/?intro=1` opens it again. Hash links go straight to their section.

`js/entry.js` owns the native dialog, keyboard focus, and 2D canvas. `css/entry.css` contains the home-specific typography, color, layout, and transitions. Edit the markup in `tools/pages/build.mjs`, then regenerate with `node tools/pages/build.mjs`.

The entrance has no rendering-library dependency. Its canvas is capped at 30fps and 1.5 device pixels per CSS pixel, stops in hidden tabs, and stops after exit. Reduced motion uses a still drawing and immediate entry. A missing entry script releases the page after 2.5 seconds; without JavaScript the portfolio remains directly accessible.

`js/page.js` downloads and mounts the full sculpture after entry and only when the sculpture is visible. Direct Work/Contact links defer it until the visitor scrolls back. The sculpture is capped at 60fps on fine pointers and 30fps on coarse pointers, and pauses offscreen, in hidden tabs, or behind the replay dialog. No extra renderer instance is created on replay.

Validation: `npm test`, `node --test test/e2e/entry.test.mjs test/e2e/work-stage.test.mjs`. Set `ENTRY_SHOTS` to a local directory for desktop, mobile, and light-mode screenshots. Entrance tests cover navigation, focus, reduced motion, touch, script failure, accessibility, resource deferral, and rendering lifecycle.
