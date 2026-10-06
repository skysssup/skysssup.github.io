# V2 — Agent 3: live system after the materials checkpoint

**Starting point:** stage 2 is implemented on `codex/hermes-sculpture-stage-1`, draft PR https://github.com/skysssup/skysssup.github.io/pull/4. Read `handoff/AGENT-2-HANDOFF.md` and `handoff/CHECKPOINT.json` for the exact delivered SHA before editing. Do not reset to main. Do not open a competing branch.

This is the complete upgraded Agent 3 prompt. The original base prompt follows unchanged in substance. Execute this document, not a stale summary.

## Checkpoint you must preserve

- Representation: image-derived WebGL2 point sculpture. Authored input is `tools/hero/sculpture.json`. Rebuild with `python tools/hero/build.py` (NumPy and Pillow). Do not hand-edit `assets/hero/*`.
- Bounds `[0.0246, 0.0703, 0.8906, 0.952]`, pivot `[0.3928, 0.5498]`, density 0.85, quiet pose yaw/pitch 0.12/0.02. Reach outline kernel 0.65 in both `js/hero.js` `edges()` and `tools/hero/build.py` `outline()`.
- Parts: wing 1, caduceus 2, arm 3, head 4, torso 5, reach 6, base 7, staff 8. Color R is material index × 51 (gold, marble, cloud, lightning, glint). Curls are marble. The extra bank (`color.webp` B) is Gear Two only. The authored lower world is in the always-on statue.
- Palettes live in `css/site.css` for `:root`, `[data-theme="dark"]`, `prefers-color-scheme: dark`, `[data-gear="two"]`, and `[data-gear="blue"]`. The dark media query must stay aligned with `[data-theme="dark"]` or clouds revert to pink.
- Glints: `GLINTS = 48`. Fragment shader draws a compact heart and short ticks, not an eight-point reticle. White support is `--figure-glint-edge` champagne. Do not restore dark axial rays on `#ffffff`.
- Protected anatomy: open-hand silhouette, grip curves, connected body, no head–torso contour. `delicate` in the vertex shader is head, reach, and the raised grip (`part == 3 && a_p.y < 0.40`). Do not put sheen stars or departing dust there. Do not bleach the palm at a sheen peak.
- Energy response: figure point `(0.505, 0.840)`, falloff `90`, mix `0.28` toward `u_lit[3]`, suppressed on `delicate`. That is the localized base response of the signature light passage. Crown and feather catch is the existing metal specular. The sheen way is the existing `WAY` vector.
- Page: evidence pages come from `evidenceOf()` in `tools/pages/build.mjs` when no body file exists. AirForge's body is authored. Proof crops are the `PROOF` map. Regenerate pages with `node tools/pages/build.mjs`. Do not publish "To write" or `data-placeholder`.
- Workload baseline at 1440×900 DPR 1, reduced motion, SwiftShader: white 97,209, dark/Tide 91,290, Gear Two 101,616 submitted points. 36-byte vertices, one draw. Do not buy frames by deleting the lower world, the glints, or the fine reach path.

## Confirmed defects you still own

1. During the native Tide flood, a second pointer press on Two, Tide, or Lights hit `HTML` and was lost. Keyboard and DOM `.click()` could still work. Do not treat `element.click()` as proof.
2. This site's root-mask path held an old displayed hero while canvas submissions continued. A minimal native-transition control stayed live. This is not a universal View Transitions freeze.
3. First opposite-paper `shape()` was about 178–217 ms in the audited software-renderer run. A preload does not remove that build cost.
4. Mid-flight reduced motion did not cancel an already-running native reveal. Timers, the native transition, the vortex, and the map sweep do not share one clock.

Reproduce these on the delivered code before changing the diagnosis. Do not reduce this stage to "make it smoother."

## Completion

The still artwork from stage 2 is a regression contract. Your job is to make that artwork live, interruptible, and measured, then close the commission. Do not merge or deploy.

---

# V2 — Agent 3: make the finished visual system live, immediate, and reliable

You are **Agent 3 of three sequential implementation agents** for `skysssup/skysssup.github.io`. Agent 1 must deliver the repaired sculpture; Agent 2 must deliver its final materials, atmosphere and responsive editorial presentation. Your substantial third is the interaction/motion architecture, runtime cost, and final integrated finish. It is not a second palette redesign or a superficial duration adjustment.

This is the original base prompt. Execute Agent 2's complete upgraded **`handoff/NEXT-AGENT-3.md`** and the latest portable package/checkpoint. Read both handoffs, verify the precise delivered branch/SHA and PR state, and inspect the actual rendered result before continuing. Do not assume a missing predecessor was completed or silently fall back to old `main`.

**Implement the remaining work and close the commission.** Do not send another generic recommendation list, delegate the difficult parts to a hypothetical fourth agent, or equate green tests with a convincing visitor experience.

## Preserve the intended result

Read `01-CREATIVE-DIRECTION.md`, `02-REGIONAL-ART-SPEC.md`, `04-PAGE-COMPOSITION-AND-MOBILE.md`, `05-MOTION-STORYBOARD.md`, `06-ENGINEERING-DECISIONS.md` and `07-ACCEPTANCE-AND-HANDOFF.md`, plus the finalized material/layer decisions from Agent 2. Open the runtime contact sheets and machine-readable measurements in `evidence/motion-audit/`.

Keep the repaired hand/body/joints, source pose, complete lower world, theme-aware glints, chosen lighting/palettes, editorial hierarchy, real proof crops and factual project content. Do not gain FPS by reverting those improvements, shrinking the whole sculpture, deleting all stars, turning the base back into dust, or making the white theme dark.

Own **F05/F06** and final closure of **F13–F16**, the live/lifecycle parts of **P12**, and all regressions introduced while integrating the earlier work.

## Start from the established mechanism, then verify it on this checkpoint

The deeper audit found more than a subjective slow animation:

1. During the current native Tide flood, a real second pointer press on Two, Tide or Lights hit `HTML` and was lost. The same API-off sequence worked. A DOM `.click()` or keyboard activation could work even when physical interruption failed.
2. This site's root-mask/compositing path held an old displayed hero while canvas submissions continued. Warm captures also held without a new map build. A minimal WebGL/2D native-transition control stayed live, so this is **not a universal claim that View Transitions freeze every canvas**.
3. First opposite-paper geometry construction was a separate roughly 178–217 ms `shape()` task in the measured environment. Fetching the small map was only a few milliseconds there. Adding a preload alone does not fix the build cost.
4. Mid-flight reduced-motion changes did not cancel the already-running native reveal. Timers/phase cleanup, native transition, hero vortex, and map sweep have different start/end clocks.

These observations are documented software-renderer evidence, not a hardware-GPU certification or proof that every browser behaves identically. Reproduce the relevant paths on the delivered code, preserve the negative controls, and update the diagnosis if the code has changed. Do not spend the entire third rediscovering what is already recorded, or fix the wrong subsystem by guessing from a timeout constant.

## Implement a coherent live mode change

### 1. Keep actual controls and art live

Replace or rework the in-page root-snapshot mode switch so its visual layer cannot intercept pointer input or hide a live state change behind an old picture. Prefer a bounded non-hit-testing overlay or renderer-owned light/palette field appropriate to this site. Native transitions for unrelated navigation need not be removed.

A second input must still hit the real control. Verify the event target and presented feedback, not just `aria-pressed` or `data-gear`. Do not disable/debounce the controls through a long animation as a workaround. Preserve the existing active-gear-to-neutral behavior and the established Lights behavior.

### 2. Give one owner responsibility for intent, progression and cleanup

Use a clear current generation/transition owner for requested mode, committed/rendered state, timers, overlays, native/WAAPI handles if retained, hero parameters and completion callbacks. New accepted input cancels or retargets from the current presented state. Old `ready`/`finished` work cannot reapply a palette, clear a newer sequence's classes or restart an old reveal.

Cancel active visual work when reduced motion takes effect and handle visibility/navigation/disposal deliberately. Keep focus stable, persisted state truthful and explicit user choices distinct from an intro's transient demonstration. Do not build a general animation framework or leave several independent timeout systems pretending to be one sequence.

### 3. Remove first-use work from the interaction's critical path

Measure the current geometry/mask/normal/layout preparation and buffer upload. Prepare/cache necessary opposite-paper representations after useful first paint using bounded work, a worker, precomputed data, or the simplest measured strategy that meets the budget. Do not move a 200 ms task into one giant “idle” callback or rebuild layouts/buffers on every phase mutation.

If target data is late or fails, keep the existing artwork legible and controls responsive. Do not fade to empty space or force a slow full reconstruction over the visitor's click. Keep cache invalidation tied to actual resolution/DPR/asset changes and report memory/download/startup tradeoffs rather than hiding them.

### 4. Choreograph the art, not a chain of waiting periods

Use `05-MOTION-STORYBOARD.md` as the starting contract: prompt local acknowledgment; concurrent palette/light/peripheral response; a coherent Tide figure around 480 ms and settled entrance around 600 ms on reference hardware; a crisper bounded red impulse; direct roughly 220–420 ms Tide↔Two retargeting; and a single coherent return to neutral. These are targets to render and measure, not magic constants or claimed results.

Keep the face, hands, staff and wing attachments readable while the lighting/environment change. Avoid a maximally dispersed cloud frozen at the transition's decisive moment, a blank middle frame, a stale neutral detour, or a second delayed entrance after the page already changed color. Gear Two can feel forceful without white-flashing/shaking the entire reading surface or continuously splitting text colors.

Integrate the selected signature light passage: depth-aware catches on metal and feather tiers, a turn across stone planes, and a local response at the base. Preserve anatomy at the peak and quiet space before/after it. Keep idle breath, wing/root motion, dust and stars phase-coherent rather than synchronizing every element or restarting all clocks after each input.

### 5. Finish opening, reduced motion, input and page media together

First paint must already be a complete appropriately themed composition. Prefer a short non-blocking light/material introduction instead of an automatic mode tour, unless an explicit current instruction protects the old sequence. Preserve protected content while making it interruptible. The first deliberate pointer/key/wheel/mode action must not be consumed by cancellation or overwritten later. The audited manual-cancellation paths already worked; preserve that success rather than claim to fix an unobserved state-theft bug.

Under reduced motion, reach the requested completed state directly and cancel any ongoing reveal/vortex/shake/parallax/pulse. A zero-duration descendant CSS rule does not cancel an already-running native/WAAPI animation by itself. A still must remain detailed, not freeze an intermediate assembly frame.

Preserve touch scrolling, keyboard Enter/Space, focus rings, understandable hit areas, saved mode and cross-route behavior. Make project stipple/wipe reveals resolve promptly into real proof; no partially wiped media after interruption/offscreen changes. Verify play/pause, Index query/close/focus return, anchor offsets, copy feedback, the dial's touch wording, footer controls and reduced-motion media behavior. Do not reinvent working features.

## Test real interruption, not a convenient surrogate

Use actual pointer/touch input or trusted browser input dispatch with logged hit targets. A test calling `element.click()` is insufficient for the reproduced overlay failure, and an automation action that waits until the animation is over does not test interruption.

At minimum:

- Neutral white/dark → Tide and Two; Tide → Two; Two → Tide; both active buttons → neutral; Lights from active and transitioning modes.
- Interrupt around 20/80/160/350/700 ms, and alternate inputs at roughly 50/150/300 ms spacing. End in each mode and neutral. Check selected semantics, visible control, actual hero palette/pose, overlays/classes and eventual state.
- OS/site reduced-motion changes during a flood, pointer disturbance, intro and map preparation. Final state must not wait for the old ceremony.
- Cold and warm assets, delayed/failed alternate map, absent native View Transition support, WebGL loss/unavailable fallback, resize, background/foreground, saved-mode reload, and Index during a transition.
- Recheck ring continuity after saved Tide reload. One page audit saw a sustained absence, but the instrumented DPR 1/2 follow-up showed it present at 8.5/13/18 seconds; treat it as a regression lead, not a universal established failure.

## Measure what reaches the visitor

Distinguish main-thread compute time, GL draw-submission intervals, and presented-image continuity. The existing on-page `MS/FRAME` is not total frame time. Virtual-time reels prove choreography/pose only; video encoding rate proves neither application FPS nor latency.

Use a quiet named hardware-accelerated reference setup if available and a documented constrained/fallback run. Aim for visible acknowledgment within 50 ms, investigate anything over 100 ms, ordinary 60 Hz rendering with p95 presented-frame intervals near 20 ms, no avoidable interaction-path task over 50 ms, and no unexplained presented hold over 100 ms during a deliberately animated entrance. Report observed values and limitations; do not certify a physical phone or Safari using an emulated SwiftShader run.

If a required environment is unavailable, say exactly what remains unverified. Do not fabricate a pass or discard the required visual detail to satisfy a synthetic counter.

## Final visual and visitor-path inspection

Revisit all thirteen regions in `02-REGIONAL-ART-SPEC.md` across white, neutral dark, Tide and Gear Two. Inspect native size, matched quiet states, DPR 1/2 detail, turn extremes, sheen peaks and transition midpoints. A briefly reappearing crosshair, broken wrist, chest seam, missing ring, clipped base or material collapse still fails.

Verify the complete home → selected proof → work/index/case → contact/footer path at 1440 × 900, 1366 × 768, 1024 × 768, 390 × 844 and 360 × 780. Keep source-verified project facts, original media colors and completed authored content. No public writing scaffolds, unreadable newly chosen proof crop, contradictory mode state or inaccessible main route should remain.

Run the relevant hero/motion/theme/page/generator and integrated browser checks after the final edit. Preserve the meaning of existing tests; never weaken/delete them to report green. Screenshots, videos, logs and code must refer to the same delivered checkpoint. The baseline test passes in the research package do not certify your fix.

## Final delivery — no fourth agent

Confirm the intended PR remains open, persist the verified code/assets on the agreed branch, and record the exact full SHA. Do not merge, enable auto-merge or deploy without explicit authorization.

Deliver `handoff/AGENT-3-FINAL.md`, a disposition for every F/P requirement, final branch/SHA/PR, exact check results, actual performance measurements and missing-environment caveats, all four final hero views, critical detail comparisons, complete page views, and natural-speed H.264 MP4s covering both direct gear directions, normal → Tide, rapid retargeting and reduced-motion change.

Refresh the manifest/checksums and portable ZIP. Publish public-safe visual evidence to the PR when supported and attach it to the user-facing delivery too. Show why the result is more coherent, detailed, beautiful and responsive; do not declare “20× better” or the owner's taste approved on their behalf. Your final handoff is the finished result with honest limits, not a plan for another agent.
