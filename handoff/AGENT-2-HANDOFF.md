# Hermes — Agent 2 handoff

Stage 2 implementation on the stage-1 branch. Implementation commit `a71ebdd7873d8dd72bb2fd007498ecfe677f06f1`. The owner has not approved the artistic result. Inspect the matched evidence rather than treating this report as that approval.

## What this stage owns

Final visual treatment of F01, F03, F04, F08, F09, F11, F12 and the page requirements P01–P11. Stage 1 anatomy is a regression contract. Stage 3 still owns live transitions, physical input, reduced-motion cancellation, and performance.

## Decisions

**Materials.** One light model, four palettes. Stone uses `--figure-fill` / `--figure-key` as a broad turn. Gold, cloud, lightning, and glint use `--mat-*` / `--mat-*-lit` with different response curves in `js/hero.js`: metal gets a darker base and a sharp catch, cloud stays quiet, energy emits locally. Gear Two no longer maps cloud, lightning, and glint to the same red. The `prefers-color-scheme: dark` block carries the same figure tokens as `[data-theme="dark"]`; the later media query was overriding the theme and painting clouds pink.

**Lower world.** `tools/hero/sculpture.json` `lowerWorld` holds authored cloud lobes, a torso shelf, and a small energy core in 424-pixel source coordinates. `tools/hero/build.py` `lower_fields()` paints them only where they do not cover the hand, wing, or torso. They are part of the always-on statue. The extra Gear Two bank is unchanged. Framing stays the stage-1 bounds `[0.0246, 0.0703, 0.8906, 0.952]` and pivot `[0.3928, 0.5498]`. The base is lobe-led, not carved architecture. That is a finished atmospheric composition, not a claim of recovered rubble detail.

**Glints and ring.** Persistent glints are limited to the strongest 48 and drawn as a small heart with short ticks that die inside the sprite. On white the support is champagne, not a dark cross. Sheen-star arms are shortened. Face, open hand, and raised grip are excluded from sheen stars and from dust departure. The ring halo stroke is `0.16` of the font and drawn at reduced alpha over the figure. Wording is unchanged.

**Signature light, for Agent 3.** Sheen still travels on the existing `WAY` from the upper-left key toward the lower right. Metal catch is the existing half-vector specular. Energy response is a falloff around figure point `(0.505, 0.840)` with coefficient `90`, strength `0.28`, and it does not reach the face or open hand (`delicate`). Do not bleach the palm at the peak. Do not add a full-scene bloom.

**Page.** The name is 40/44 on desktop and 32/36 on narrow screens. The myth panel is a quiet rule, not a heavy box. The caption is one sentence; the dot count sits in a subordinate line that hides on phones. Tablet puts the figure beside the introduction and the panels below it, so they no longer overlap the caption or push the sculpture off the first screen. Selected-work plates are a 2/2 split with a stagger, and proof crops focus AgentCrucible on the verdict, Shipgate on the action, and AirForge on the physical scene. Recall stays a type plate. Projects without a body file publish a concise evidence page from verified summary, status, media, and source. AirForge's authored case is unchanged. No public "To write" scaffold remains.

## Workload

Submitted points at 1440×900, DPR 1, reduced motion, SwiftShader. Stage 1 counts in parentheses.

| Mode | DPR 1 |
| --- | ---: |
| White | 97,209 (89,695) |
| Dark / Tide | 91,290 (80,811) |
| Gear Two | 101,616 (96,316) |

The increase is the lower-world coverage, not a density multiplier. Vertex stride is still 36 bytes. No new draw pass.

## Checks

- `npm test` — rerun after the final asset and page generation. 92 unit/content checks were green before the last still regeneration; `npm run og` must be rerun when `still.webp` changes.
- Quiet captures: `handoff/evidence/stage-2/hero-*.png` at 1440×900, DPR 1, yaw/pitch 0.12/0.02, Grid off.
- Page captures: `desktop-home.png`, `tablet-home.png`, `phone-home.png`, `phone-selected.png`, `case-agentcrucible.png`.
- Natural-speed light recording: `light-review.mp4` (37.7 s, H.264, 0 page errors). Encoding rate is not browser FPS. Software renderer, not a hardware or phone certification.
- DPR 2, dark/Tide/Gear motion, and physical devices were not recorded in this pass.

## Do not undo

- Open-hand notch, grip curves, connected body tone, marble curls, staff silhouette, 0.65 reach kernel, bounds, and pivot.
- Five-material schema. Do not paint the broad cloud bank gold; pink billows fail a warmth test and turn the base mauve.
- Evidence-page generator. Do not restore `data-placeholder` or "To write".
- Proof crops in `PROOF` in `tools/pages/build.mjs`. Do not theme-recolor project media.

## Still open for Agent 3

F05, F06, F13–F16, P12, and the live parts of F04/F09/F12. Pointer interception during the Tide flood, presented-image hold, and the first opposite-paper `shape()` cost are unchanged by this stage. Mobile selected-work heading lands around 1100 px of document depth, past the 900 px proposal, because the full sculpture is kept. Do not shrink the figure to hit that number.
