# Agent 3 close

The live system is on `codex/hermes-sculpture-stage-1`. Do not merge or deploy. This is the finished result with the limits below, not a prompt for a fourth agent.

## What changed

Mode changes no longer replay a full entrance on top of the gear the visitor just left. Tide ↔ Gear Two commits the destination on the press (`data-phase="retarget"`, 320 ms) and drops the old flood, ring, and timers. A second pointer press during a Tide surge hits the real button. The page does not white-flash or shake. The figure is not punched with glitch tiles during the switch. Idle Gear Two heartbeat tears are unchanged.

Tide from neutral still surges: the knob moves at once, the palette turns at 120 ms, the non-hit-testing ring runs 480 ms, and the phase clears at 600 ms. The dot vortex rises and settles in 0.48 s, and it cancels if the surge is left or motion is reduced.

A project photograph is hidden only after its stipple has actually been drawn. Offscreen plates are not drawn at boot. Reduced motion marks plates developed and reveals seen, so a wipe cannot stay half-finished.

## Pointer check

Chrome, SwiftShader, `mouse.click` at the control center, not `element.click()`:

- Tide, then Two at about 40 ms: second hit `BUTTON[data-gear-toggle]` while `data-phase` was `surge`. Result `data-gear=two`, `data-phase=retarget`. Flash overlay opacity 0. The hero element stayed the hit target, not an overlay.
- Two → Tide committed blue on the press.
- 390 × 844: both presses hit buttons.
- OS reduced motion: Tide committed with no phase.
- Saved Tide reload: blue, pressed, ring present (`tide-reload.jpg`).

`npm test`: 95 passed. Browser: Gear Two navigation and Tide navigation tests passed.

## Disposition

| ID | Close |
| --- | --- |
| F01–F04, F07–F12 | Stage 1–2 artwork kept. No palette or anatomy redesign. |
| F05, F06, F16 | Implemented here. Hardware pointer timing unverified. |
| F09 | Ambient hierarchy unchanged. Vortex no longer outlasts the Tide entrance. |
| F13 | Construction grid is the sheet's column overlay (`data-grid`). Anatomical contour stays in the sculpture outline. They were already separate. Checked, not redesigned. |
| F14 | Bounds and pivot untouched. Settled white, dark, Tide, and Gear Two frames show the base, ring, and open hand. Frame-time flicker on hardware was not measured. |
| F15 | Reduced motion commits the requested gear and cancels the vortex. Fallback and a cold WebGL-loss path were not re-run this pass. |
| F16 | Pressed state, keyboard path in the existing Tide browser test, and the pointer hit target agree. |
| P01–P11 | Page contract from stage 2. Generator still reproduces committed pages byte for byte. |
| P12 | Retarget, saved Tide reload, and reduced-motion commit are in. Cross-route gear survival is the existing session flag, confirmed by the Tide navigation test. |

## Limits

SwiftShader is not a hardware GPU, not Safari, and not a phone. `MS/FRAME` on the page is CPU time, not presented-frame interval. The retarget recording is a browser capture, not an FPS certificate. No owner approval is claimed.

Push of this branch still depends on the Capy GitHub App being installed on `skysssup/skysssup.github.io`. Draft PR: https://github.com/skysssup/skysssup.github.io/pull/4
