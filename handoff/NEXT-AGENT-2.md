# V2 — Agent 2: materials, world and editorial page after the sculpture checkpoint

You are **Agent 2 of three sequential implementation agents** for `skysssup/skysssup.github.io`. Agent 1 has delivered the sculpture source, generated assets, matched evidence and checked live renderer; your third is to turn that object and its surrounding page into a coherent, visually exceptional showcase. Do not mistake this for a color-token edit, a generic “premium UI” pass, or a reason to add more effects everywhere.

This is the complete upgraded Agent 2 prompt. Use the refreshed stage-1 ZIP and `handoff/AGENT-1-HANDOFF.md`. The original base prompt is retained for traceability; this document preserves its entire remaining scope.

## Exact starting checkpoint and working interfaces

Repository: `skysssup/skysssup.github.io`; branch: `codex/hermes-sculpture-stage-1`; draft PR: https://github.com/skysssup/skysssup.github.io/pull/4 (open and unmerged when handed off). The pushed implementation SHA is `26d83d7ade86827cda91777ec799cba1594787fd`. A following handoff commit supplies these documents, reproducible evidence and a newline-only build portability fix; `handoff/CHECKPOINT.json` in the refreshed package records the exact delivered tip. Fetch it, verify its head and the PR's open state before writing. Do not reset to the original audited main, create a competing branch, or start Agent 3 in parallel.

Fresh checkout: clone https://github.com/skysssup/skysssup.github.io.git, check out this branch, run `npm ci`, install NumPy/Pillow into the Python runtime, and serve with `python -m http.server 8080`. Tests used Node 24.19.0, Python 3.12.14, NumPy 2.3.5, Pillow 12.3.0 and installed Chrome. Set `CHROME_PATH` only when that executable is elsewhere; no secrets are required. Public read access alone is not push authorization: verify destination write access again.

The implementation remains plain HTML/CSS/JS and custom WebGL2. `tools/hero/sculpture.json` is authored input in 424-pixel source coordinates. `tools/hero/build.py:maps`, `sculpture_tone`, `correct_relief`, `parts`, `feathers` and `material_map` consume it. Do not hand-edit generated maps. Rebuild with `python tools/hero/build.py`, verify with `python tools/qa/stage-1/rebuild.py <output>`, and regenerate affected share images with `npm run og`.

The open-hand source window protects its foreshortened finger groups and thumb web. `bodyRelief` carries body/throat/grip planes; `gripCurves` carries the source's three curled finger groups plus opposing thumb; `structuralRelief` carries wing tiers/crown/shaft; `staffSilhouette` survives inferred-depth loss and is painted behind the grip. The support footprint/relief is the existing base's contact interface. The ordinary support remains visible in all modes; `color.webp` B denotes extra bank-only ownership, still shown only in Gear Two.

Keep existing schemas: depth R=relief, G=detail, B=part×32 (minus 16 in the fringe); R=0 outside, where B names sky stars. Parts: wing 1, caduceus 2, arm 3, head 4, torso 5, reach 6, base 7; runtime lower caduceus motion uses staff 8. Color R=index×51 for gold/marble/cloud/lightning/glint, G=weight, B=bank ownership, A=128+sparkle. Normals are reconstructed from the corrected relief. Curls are stone with light-derived warmth; do not reinstate a solid gold cap.

Bounds are `[0.0246, 0.0703, 0.8906, 0.952]`, pivot `[0.3928, 0.5498]`, density 0.85. Preserve the existing fine-DPR path and bounded relief turn. The quiet reference is yaw/pitch 0.12/0.02 radians. Source-traced tips require the 0.65 depth-map-pixel `reach` kernel in both runtime `js/hero.js:edges()` and offline `outline()`; the other parts keep 1.2. Head–torso is a connected surface and has no contour in `hero.json:over`.

Protected regression evidence: repository `handoff/evidence/comparison-*.jpg`, `grayscale-*.jpg`, `workload.json`, two natural-speed review MP4s and event logs. The full package has native PNGs at `evidence/stage-1/before/`, `after/`, `mobile-390/`, `mobile-360/`, plus native H.264 motion at `live-final/`. Rejected intermediate tone/mask passes are labeled separately. Inspect native white/dark at DPR 1 first. The palm may not become empty, fingertips may not collapse, grip may not become a hole, chest may not become bands, and throat may not regain a seam. Do not gold-classify or bloom away these repairs.

Actual checks: all 92 unit/content tests (`npm test`) and all 37 hero browser resilience tests (`node --test test/e2e/hero-resilience.test.mjs`) passed; loading/fallback checks were repeated after the newline-only metadata fix. The cached pipeline is byte-reproducible. This does not certify the known transition problems or hardware performance. Submitted points at 1440×900 are white 89,695/226,252 (DPR1/2), dark and Tide 80,811/203,364, Gear Two 96,316/243,799. White rose about 4%, dark/Tide 26–27%, Gear Two 21–22% from baseline due to repaired value coverage. No additional draw pass or density multiplier was added. Keep the 36-byte vertex layout and preserve anatomical quality if simplifying effects.

You still own final material, lower-world, glint and page closure. Stage-1 source fixes are implemented and await owner review; F11's final material hierarchy and F01/F08's complete composition remain open. All other remaining concerns retain their original scope and IDs in the following full commission. Physical phone/Safari/hardware-GPU timing and cold/warm construction were not tested in this stage and still need honest measurement.

**Implement, render, refine, verify, and hand off.** Do not only write another prompt. Agent 3 will make your finished visual system behave continuously and reliably; it must not be asked to animate away unfinished still artwork.

## Read and preserve

Read the V2 `README.md`, `01-CREATIVE-DIRECTION.md`, `02-REGIONAL-ART-SPEC.md`, `03-MATERIAL-LIGHT-AND-COLOR.md`, `04-PAGE-COMPOSITION-AND-MOBILE.md`, `06-ENGINEERING-DECISIONS.md`, and `07-ACCEPTANCE-AND-HANDOFF.md`. Open the reference, matched close-up boards, palette/lower-scene studies, and page-audit annotations—not just their filenames. Verify Agent 1's actual rendered result and exact delivered branch/SHA.

Preserve the Hermes gesture, point-sculpture identity, repaired hand/body/joints, supported turn/bounds, the site's Instrument Sans/Fragment Mono pairing, real project facts/media, existing routes, Index, contact/dial, meaningful keyboard behavior, and reduced-motion/static presentation. Do not undo the first third while making the second more dramatic.

The owner wants richness and craft, not timid desaturation. Concentrate the spectacle in believable surfaces, depth, selective light and a finished lower world. Avoid luxury-template clichés, unrelated ornaments, a gradient card wall, fake dashboards, new credentials, or new features that do not address the evidenced problems.

## Own this third

Own final visual closure of **F01, F03, F04, F08, F09, F12**, plus the page/editorial requirements **P01–P11**. Agent 1 supplies foundational forms/contact; you complete their material and compositional treatment. Agent 3 owns live transition behavior, performance integration and final cross-system verification.

### 1. Make materials read as materials

Work with a shared light environment rather than a flat recolor. Start from the source's warm upper-left/front key, cool fill and localized lower reflected light, then adapt each mode deliberately. Restore connected midtones, directional reflections and contact values so stone, metal, cloud, rubble and energy remain distinguishable.

Use `03-MATERIAL-LIGHT-AND-COLOR.md` and the palette study as concrete starting ramps, not blind replacement tokens. Produce two serious same-pose material/light studies on Agent 1's repaired geometry, select the stronger one using the source and actual rendering, then finish it. Do not produce endless unrelated palettes instead of making a decision.

- **White:** retain real white paper. Stone needs connected visible planes, not black cuts and empty highlights; gold needs bronze/champagne depth rather than a mustard fill; lower clouds need atmospheric shape rather than pink dust.
- **Neutral dark:** luminous stone and selected warm metal must emerge from cool depth without making every edge glow. Preserve dark recesses so the light has contrast.
- **Tide:** make it a marine light environment with icy/cyan accents and a restrained warm metal note—not a blue filter that erases material distinctions.
- **Gear Two:** retain its red/ember force while separating stone, copper/gold, cloud and energy by value, hue range, area and response. Do not leave all those materials mapped to the same red.

Keep the surrounding UI text/controls readable and the real product screenshots in their original colors. A mode is not permission to tint evidence or change its meaning.

### 2. Finish the lower world as a composition

Use the source's actual spatial vocabulary. Build a quiet back atmosphere, a few readable supporting ledges/faces/recesses, a convincing torso contact, a localized energy core with subordinate structure, and an asymmetric foreground cloud edge. These are compositional roles—not a requirement for five new render passes or a pile of new objects.

Choose what is in front, behind and partially obscured. Give rubble top/side planes and selective reflected light. Give clouds lobes and interior shadow at several scales; vary perimeter density/opacity/size coherently without blurring the whole scene. The energy feature must read as structure with a local influence, not a vertical cyan smudge or continuous full-scene bloom.

Keep the open hand and the torso/base interface clear through the supported turn range. A more extensive red bank can remain a deliberate mode variation, but white, dark and Tide also need a finished base. Reject an oval dust heap, repetitive cloud stamps, a horizontal crop, disconnected cotton clumps, unrelated temples, or extra geometry whose only purpose is filling blank space.

### 3. Solve optical detail and ambient hierarchy

Fix the white-background crosshair problem in shape, scale, contrast and antialiasing—not only hue. The existing code draws bolder dark-edged axial glints on white. Prototype compact optical points/facets with restrained tapered support and controlled local contrast. Test actual native-size sprites on plain `#ffffff`, gold, cloud and busy detail, at rest and during a sheen. The supplied procedural glyph study is only a proposal, not an approved final sprite.

Check both persistent glints and transient sheen stars. Protect the face and both hands from false eye/finger-like highlights. Preserve the successful luminous character in dark modes; do not hide all white stars. Make the strongest glints rare and motivated by material/focal structure, not identical stamps at every source highlight.

Separate surface stipple, near-surface dust, lower-scene motes, attached material glints and distant stars. Give each a purpose and appropriate density, scale, depth, brightness and eventual motion envelope. Compose concentrations and quiet gaps from the reference. Increasing every particle count is not atmosphere.

The intended signature light passage should catch the crown, resolve feather tiers, turn across stone planes and prompt a localized lower-energy response. Preserve detail at the peak; no bleaching the palm, global star flash or flat stripe over a picture. Hand Agent 3 the finalized spatial/material parameters and choreography intent, not vague adjectives.

### 4. Make the ring and page support the artwork

Keep the ring's wording and identity, but stop heavy letter halos from carving through the torso. Use appropriate foreground/back depth, placement, contrast and a restrained knockout. The rear arc may recede; it does not need headline readability. Keep the optional construction grid separate from anatomical contours and ordinary sheet lines.

Refine the existing editorial system rather than replacing it. Give the author name a distinct, controlled display role; distinguish project titles from descriptions; subordinate the heavily framed myth explanation and primary telemetry; keep the main CTA obvious. Typography must improve the whole composition, not simply make every heading larger.

Compose tablet and mobile explicitly. At 1024 × 768, avoid placing both substantial copy panels before a partly visible sculpture. At 390 × 844 and 360 × 780, preserve the full useful hero scale and early CTA, shorten the primary caption, and bring real selected proof ahead of long supporting explanation/taxonomy. Keep a visible understandable Index entry and usable adjacent gear/light hit regions. Preserve logical DOM/keyboard reading order.

For selected work, retain authored asymmetry but rebalance the extreme wide/narrow split. Use truthful content-specific proof crops: an actual AgentCrucible verdict/failure, Shipgate action/reason, AirForge physical scene. Preserve original media and full context on the case route. Do not invent or theme-recolor results. Recall's type-only plate is intentional; make it purposeful rather than fabricate a screenshot.

Refine `/work/` as a compact list and a useful visual grid without changing filter/search/history semantics or removing projects/visibility labels. Finish contact/footer rhythm while keeping email, the personal day dial, copy, source and motion controls. Do not add a new contact product to avoid detailing the existing one.

### 5. Remove public authoring scaffolds truthfully

The lead case actually publishes “To write” instructions and a placeholder diagram; the pinned source contains the same scaffold pattern in seven case pages. Its real media works. This cannot be fixed by a more attractive border or by hiding every empty section with CSS.

Change the actual page data/template/generator. Where verified narrative exists, present it accurately. Where it does not, publish an intentionally concise evidence page using the real summary, status, media, captions and source links; retain an honest in-progress label where useful. Do not manufacture architecture, achievements, benchmark numbers or an elaborate case study to fill a template. Preserve completed authored cases, and make TOCs/actions match the sections actually rendered.

## Work and verify like an art director, not a token editor

Render each substantial change, inspect native scale first, then source-adjacent detail and a thumbnail/grayscale view. Recheck Agent 1's hand/body after every material/density change. Reject an intermediate result that looks attractive only on black, only at DPR 2, only at one pose, or only under a peak glow.

Deliver matched quiet/full-motion artwork views in all four modes at 1440 × 900 DPR 1/2, with hand/face/body/metal/base/cloud/energy/white-glint crops. Check 1366 × 768, 1024 × 768, 390 × 844 and 360 × 780 compositions. Interactively scroll project media and inspect settled states before calling them missing or complete. Show the whole visitor path, not just the hero.

Run relevant hero/material/asset and generated-page/content/behavior checks, regenerating stills/previews or page outputs when their sources change. Record source/asset sizes, point/workload changes and actual results. Do not weaken tests. Current timing/control defects may remain for Agent 3, but list them accurately; do not call the live experience finished yet.

## Completion and cross-instance handoff

Your still artwork must be convincing in white, dark, Tide and Gear Two; the lower world must be complete; glints must read optically; and the surrounding responsive page must lead into truthful usable proof. An unresolved hand regression, white reticle, dust-pile base, unreadable proof crop or public authoring scaffold fails your stage.

Continue the agreed branch/PR only after verifying it is open and the remote head matches the handoff. Push the tested code/assets. Do not merge, enable auto-merge or deploy.

Deliver `handoff/AGENT-2-HANDOFF.md`, the exact branch/SHA/PR, selected material tokens and light responses, layer/mask/particle-class decisions, page generator changes, true proof-asset sources, actual checks, before/after PNGs and natural-speed MP4s, remaining issue ledger, manifest/checksums and refreshed ZIP.

Keep `PROMPT-3-MOTION-AND-FINAL-QA-BASE.md` unchanged and write **`handoff/NEXT-AGENT-3.md` as a complete upgraded prompt**. Insert your actual checkpoint, final visual decisions, changed entry points, workload baseline, protected geometry/palettes/crops, and every remaining live-state acceptance gate. Preserve the confirmed pointer-interception, presentation-hold and cold-construction findings; do not reduce Agent 3 to “make it smoother.” Completed visual work becomes a regression contract, not scope to redesign again.
