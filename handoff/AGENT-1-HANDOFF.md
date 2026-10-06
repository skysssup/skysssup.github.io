# Hermes — Agent 1 handoff

Stage 1 implementation, prepared 2026-10-07. The source pose and live point renderer are retained. The owner has not approved the artistic result; inspect the matched evidence rather than treating this report as that approval.

## Durable checkpoint

- Repository: https://github.com/skysssup/skysssup.github.io
- Branch: `codex/hermes-sculpture-stage-1`
- Starting SHA: `31ab973f60d805a143609acd677b4073624929ba`
- Pushed implementation checkpoint: `26d83d7ade86827cda91777ec799cba1594787fd`
- Draft PR: https://github.com/skysssup/skysssup.github.io/pull/4 — open, unmerged.
- A subsequent handoff commit contains these documents, QA evidence, and a newline-only pipeline portability fix. The refreshed ZIP's `handoff/CHECKPOINT.json` records its exact delivered tip. Fetch the branch and check its head and this PR's state before continuing; keep one sequential branch/PR.
- Publication: code is pushed on the draft branch. Main/Pages have not been changed.

```sh
git clone https://github.com/skysssup/skysssup.github.io.git
cd skysssup.github.io
git checkout codex/hermes-sculpture-stage-1
git rev-parse HEAD
npm ci
# The tested browser is installed Google Chrome. Set CHROME_PATH for another installation.
python -m pip install numpy pillow
python -m http.server 8080
```

Node 24.19.0; Python 3.12.14, NumPy 2.3.5 and Pillow 12.3.0 were used. Model caches are already tracked; ordinary rebuilding needs no model download. No secrets or required environment variables are supplied. Optional QA variables: `CHROME_PATH`, `SOURCE_SHA`, `W`, `H`, `DPRS`, `MODES`.

## What changed and why

| Issue | Implemented contribution | Evidence / continuing scope |
| --- | --- | --- |
| F02 | Source-traced open-hand silhouette, preserved fingertip-group notch, connected palm/thenar/digit relief and bounded palm tone. Raised grip has authored curved knuckle planes and an opposing thumb. | `evidence/comparison-light-dpr1.jpg`, `comparison-dark-dpr1.jpg` and DPR 2 counterparts. The source indicates foreshortened groups, not five equally visible fingers. |
| F07 | Source-led broad tone replaces the stacked high-pass/depth-step/cavity amplification inside the protected anatomy. Broad pectoral, abdomen and throat relief is authored explicitly. The head–torso contour was removed. | White/dark source-adjacent crops and `grayscale-*.jpg`. Legitimate source muscle ridges remain as middle forms. |
| F10 | Forehead/nose/cheek/jaw/throat values remain connected; curls use stone instead of a blanket gold cap. The grip received local middle-form corrections after a filter-only pass lost its structure. | Quiet four-mode comparisons, native PNGs in the full ZIP, and moving white/dark views. |
| F11 | Wing root/feather tiers and crown planes have bounded relief; the source's visible shaft is kept continuous in the part mask and the grip is painted over it. Feather/coil detail is subordinate to broad source value. | Structure implemented; final bronze/champagne reflectance, optical glints and crown/wing material hierarchy remain Agent 2's scope. |
| F01 / F08 | Source-derived support/contact footprint and a shallow ledge relief connect the torso to its existing base. The extended hand stays in front of the environment. | Foundational contribution only. Final rubble, cloud, energy composition and perimeter taper remain open for Agent 2. |

All original F01–F16 and P01–P12 are retained in `ISSUES.json`; no unimplemented page or lifecycle issue was removed.

## Representation and regression contract

The chosen representation is the existing image-derived WebGL2 point sculpture with corrected masks, values, relief and boundaries. No surface/image replacement was needed for this pass. The anatomy fixes are evaluated in actual white and neutral dark quiet renders, not only under a sheen. There is no claim of a full 360-degree mesh from the single 424-pixel source.

Authored input is `tools/hero/sculpture.json`. Coordinates are 424-pixel original-source coordinates; broad relief is an authored estimate, not recovered hidden detail. Keep this input separate from generated `assets/hero/*`. In `tools/hero/build.py`:

- `maps()` applies the hand window/silhouette and source-lit support footprint before mask reduction. `hand_weight` feathers the forearm entry.
- `sculpture_tone()` protects body, palm, grip, face/throat and curls. Broad value comes first; source marks and cavity are bounded. `gripCurves` carries the source's curled finger groups without black outlined bands.
- `correct_relief()` consumes `bodyRelief`, `structuralRelief`, `openHand.relief`, and `support.relief` after rigid-part smoothing. `parts()` consumes `staffSilhouette`, then paints the grip in front.
- `feathers()` preserves broad reference value and subordinate directional detail. Its middle-form correction must survive Agent 2's metal-light changes.
- `material_map()` keeps curls marble. Stone warmth should come from the light, not restoring a uniform gold assignment.
- `outline()` and `js/hero.js:edges()` both use a 0.65-pixel depth-map kernel for `reach`; other parts retain 1.2. Keep both implementations consistent so the fallback retains the notch.

Generated fields retain their existing consumers:

- `depth.webp`: R relief, G detail, B part code inside the mask (`part * 32`, minus 16 in the fringe); outside R=0, B names sky-star strength. Labels are wing=1, caduceus=2, arm=3, head=4, torso=5, reach=6, base=7. Runtime treats lower caduceus as staff=8 for motion.
- `color.webp`: R material index ×51 (gold, marble, cloud, lightning, glint); G material weight; B bank-only ownership; A=128+sparkle. No new hypothetical fields were introduced.
- The existing extra bank stays Gear-Two-only; the ordinary support/base is usable in every mode. Agent 2 must build its final world on that relationship.
- Bounds `[0.0246, 0.0703, 0.8906, 0.952]`; pivot `[0.3928, 0.5498]`; density 0.85; existing DPR fine path retained. Quiet pose is yaw/pitch 0.12/0.02 radians. Natural recordings include yaw on both sides of approximately ±0.274 rad plus pointer response; the white recording reaches −0.383 rad. This is a bounded relief turn, not unseen back anatomy.

Do not reintroduce blank palm islands, saturated chest bands, a throat seam, a gold hair cap, a missing staff segment, or softened fingertip separation. Materials must preserve these forms at DPR 1 and phone size.

## Verification and workload

Executed on Windows with installed Chrome and ANGLE/SwiftShader software rendering:

| Check | Command / result |
| --- | --- |
| Unit, content, generated pages, motion/theme | `npm test` — 92/92 pass; `evidence/stage-1-unit-final.log`. |
| Full hero resilience | `node --test test/e2e/hero-resilience.test.mjs` — 37/37 pass; `evidence/stage-1-resilience-final.log`. Covers loading/first paint, context loss/restore, delayed/failed assets, fallback, reduced motion, touch, four-mode renderer behavior and opening. |
| Metadata/fallback after the newline portability correction | `node --test --test-name-pattern='loading waits\|static fallback' test/e2e/hero-resilience.test.mjs` — final result in `evidence/stage-1-metadata-final.log`. |
| Rebuild | `python tools/qa/stage-1/rebuild.py <output>` — cached pipeline exits 0 and reproduces hero assets byte-for-byte; `evidence/reproducibility.json` / `build.log`. |
| Affected share images | `npm run og`; home/work refreshed and stamp updated. Unchanged case-share PNGs were retained to avoid unrelated rasterizer differences. |
| Quiet visual matrix | `node tools/qa/stage-1/capture.mjs . <output>` — 1440×900, all modes, DPR 1/2. `W=390 H=844 DPRS=1`, then `W=360 H=780 DPRS=1` for phones. Phone capture scrolls the live hero into view. |
| Natural motion | `node tools/qa/stage-1/live.mjs <output> light` and `dark` — genuine wall-clock, trusted pointer movement, resting and moving frames, zero page errors. Event/rotation records accompany H.264 review MP4s; full native 1440×900 MP4s are in the ZIP. |

`comparison-*.jpg` are annotated source-adjacent crops; source is unrotated, captures share the quiet pose. Native full-frame/hero PNGs, phone captures and rejected intermediate passes remain in the full package under `evidence/stage-1/`. The review MP4s are 960×600 transcodes at natural speed, so use native PNGs and the full MP4s for close anatomy review. Encoding frame rate is not presented browser FPS.

| Mode | Submitted points, DPR 1 before → after | DPR 2 before → after |
| --- | ---: | ---: |
| White | 86,453 → 89,695 | 218,053 → 226,252 |
| Dark | 63,893 → 80,811 | 159,544 → 203,364 |
| Tide | 63,893 → 80,811 | 159,544 → 203,364 |
| Gear Two | 79,451 → 96,316 | 200,137 → 243,799 |

The increase follows the repaired value coverage, not a global sampling multiplier. It is a real draw-cost increase: about 4% on white, 26–27% on dark/Tide, and 21–22% in Gear Two. Vertex stride remains 36 bytes and there is no additional draw pass. `workload.json` distinguishes submitted points from the caption's surface-dot count. Asset sizes/hashes are in `reproducibility.json` and the package manifest.

Physical phones, Safari, hardware-GPU frame timing, cold/warm interaction long tasks and the full site-wide E2E suite were not tested here. The known stage-3 transition/pointer/performance findings remain open; this pass does not certify them. Existing software-renderer and first-opposite-paper construction costs must be measured again in stage 3.

## Next stage

Give a fresh Agent 2 the complete refreshed ZIP plus `NEXT-AGENT-2.md`. The latter is the complete upgraded prompt, including all original material, lower-world, glint, ring, responsive editorial and truthful case-page scope. The base prompt is preserved unchanged in the ZIP. Agent 2 must maintain this anatomy while completing F01/F03/F04/F08/F09/F12 and P01–P11, then deliver its own tested checkpoint and full upgraded Agent 3 prompt. Do not start another implementer in parallel or merge/deploy this branch automatically.
