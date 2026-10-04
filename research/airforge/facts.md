# AirForge: facts behind the case study

Repository `skysssup/airforge` at `72d491b` (Release 1.2.0). Every number and mechanism on `/work/airforge/`
is listed with where it was checked. Commands ran in a clean clone with Node 24.18.0.

## Numbers panel

| Claim | Verified by |
|---|---|
| 208 Vitest tests (unit, component, headless physics), all passing | `npm test`: `Test Files 20 passed (20)`, `Tests 208 passed (208)` |
| 12 Playwright browser tests, run by CI on every push | `npx playwright test --list --project=chromium`: `Total: 12 tests in 4 files`; `.github/workflows/ci.yml` job `browser` runs `npm run test:e2e` on pushes to `main` and on pull requests; CI run for `72d491b` passed |
| 6 examples, each outcome checked in a headless Rapier world | `src/examples.ts` `EXAMPLES` (6 entries); `src/examples.test.ts` `describe('what each example does after Drop')` has one test per example |
| 1/60 s fixed physics step, the same in the browser and in tests | `src/physics/world.ts:28` `TIME_STEP = 1 / 60`, used by `src/render/PhysicsWorld.tsx` (`<Physics timeStep={TIME_STEP}>`) and `src/test/headlessWorld.ts` (`world.timestep = TIME_STEP`) |
| 40 objects per scene; files over 512 KB refused | `src/physics/params.ts:56` `MAX_OBJECTS = 40`; `src/io/schema.ts:24` `MAX_JSON_BYTES = 512_000` |

## Body

| Claim | Verified by |
|---|---|
| A drawn circle sets the ball radius, 0.15 to 1.5 units | `src/physics/params.ts:37-38`; `src/scene/objects.ts` `objectFromRecognition` clamps `drawnRadius` |
| Rectangles keep their tilt | `src/scene/objects.ts` `objectFromRecognition`: the longest edge sets `rotationZ` |
| Unclear strokes stay dashed until the user chooses | `src/store/appStore.ts` `endStroke` sets `pending`; `src/ui/PendingStrokePicker.tsx` offers Ramp, Ball, Platform, Discard |
| Drop, Restart, Freeze behavior | `src/store/appStore.ts` `drop` (`releasedFrom`), `restart`, `freezeBalls` |
| Six examples open from a menu or a `?example=` link | `src/examples.ts`; README "Examples" |
| Webcam: raise index finger to draw, pinch to finish, open palm cancels | `src/hand/gestures.ts` `classifyRawGesture` (`draw`, `pen_up`, `erase`) |
| Mouse and touch points kept as drawn, webcam points smoothed | `src/stroke/capture.ts:1-5,36-46` (`SMOOTH_WINDOW = 4` applies only to `source === 'webcam'`) |
| A drag within 6 px is a click that selects | `src/store/appStore.ts:66` `TAP_SLOP = 6`; `endStroke` calls `selectAt` when `isTap` |
| Recognizer order line, circle, rectangle; geometric tests, no model | `src/shapes/recognize.ts:1-7` (header comment), `recognizeStroke` |
| Circle: spread of distances under 18% of the radius, at least 300° swept | `src/shapes/recognize.ts:164` `minCoverage = 5.24`, `:173` `radiusVariationCoeff < 0.18` |
| Rectangle: convex hull simplified to four corners, angles 70° to 110° | `src/shapes/recognize.ts:203-213` (`convexHull`, `approxPolyDP`), `:259` |
| Weak circle that is also a rectangle goes to the picker | `src/shapes/recognize.ts:86` (`circle.quality < 0.75`), `src/store/appStore.ts` `endStroke` |
| Colliders: boxes for ramps and platforms, spheres for balls, floor and two walls | `src/physics/world.ts` `BOUNDARY`, `boxFor`; `src/render/PhysicsWorld.tsx` `BallCollider` |
| Balls cannot move in depth | `src/render/PhysicsWorld.tsx:160` `enabledTranslations={[true, true, false]}` |
| Moving balls write their position every frame; Freeze, Save, selection, Undo read it | `src/render/PhysicsWorld.tsx:141` `setLiveBallPose`; `src/physics/livePoses.ts` header; `src/store/appStore.ts` `objectsWithLivePoses` |
| 16 recognizer tests | `npm test`: `src/shapes/recognize.test.ts (16 tests)` |
| Before 1.1.0 each step used the frame's duration | `CHANGELOG.md` 1.1.0, Changed |
| Slow frames run several fixed steps; rendering interpolates between steps | `@react-three/rapier` `Physics`: delta clamped to 0.5 s, accumulator loop of `timeStep` steps, `interpolationAlpha`; `src/physics/world.ts:27` comment |
| Velocities are not stored by Undo or scene files | README "Limitations"; `src/io/serialize.ts` `objectsToSerialized` writes positions only |
| MediaPipe loads only when the webcam starts; frames stay in the browser | `src/ui/WebcamPanel.tsx:133` dynamic `import('../hand/landmarker')` after the camera opens; build output puts it in its own chunk (`landmarker-*.js`, 154 KB); README "Webcam" |
| Webcam mode needs jsDelivr and Google Cloud Storage | `src/hand/landmarker.ts:11-14` `WASM_CDN`, `MODEL_URL` |
| Hand tracking runs on the main thread | README "Limitations" |
| Example outcomes checked for the saved scene plus 8 (Funnel: 20) copies nudged by up to 0.02 units | `src/examples.test.ts:25-31` (`count = 8`, `(seed / 2147483647 - 0.5) * 0.04`), `:173` `variants(objects, 20)` |
| Three old examples did not do what they described | `CHANGELOG.md` 1.1.0, Fixed (Ramp & Ball, Double Ramp, Stairs Drop) |
| Ramp & Ball rests at (3.61, −2.53) headless and in three Chromium runs | Headless: `createHeadlessWorld` on `public/examples/ramp-and-ball.json`, all balls dynamic, 10 s, printed `(3.61, -2.53)` twice. Chromium (headless Chrome 154, SwiftShader): the built app at `?example=ramp-and-ball`, Drop, 12 s, Save; the saved ball position was `(3.61, -2.53)` in all three runs |
| Of three Funnel runs in Chromium, one settled differently | Same method on `?example=funnel` (15 s): run 1 first balls `(-0.60, -3.05) (-0.95, -3.65)`, runs 2 and 3 `(-0.71, -3.16) (-1.20, -3.65)` |
| Funnel test requires all twelve balls in the box | `src/examples.test.ts` `Funnel: all twelve balls end up in the box` |
| Gesture after 3 identical frames; hand lost more than 2 frames cancels; jump over 160 px cancels | `src/hand/gestures.ts:13-14`; `src/stroke/capture.ts:13` `MAX_POINT_GAP = 160` |
| The demo loads AirForge 1.2.0 from GitHub Pages, deployed from `main` | `.github/workflows/deploy.yml`; the live `/airforge/` page loads `assets/index-BoYCuddX.js`, the same file `npm run build` produces at `72d491b` |
| Live app download about 1.25 MB | gzip transfer from the live site: JS 1,185,379 B, CSS 4,400 B, fonts 31,176 + 23,272 B, HTML 946 B |
| CI: tests, lint, build, Chromium browser tests | `.github/workflows/ci.yml`; `npm run lint`: `Found 0 warnings and 0 errors` |
| Bundle about 3.5 MB, 2.1 MB of it Rapier's WebAssembly as base64 | `npm run build`: `index-*.js 3,477.67 kB │ gzip: 1,185.89 kB`; the largest base64 run in that file is 2,092,532 bytes and starts `AGFzbQEAAAAB` (the WebAssembly header) |
| Shapes in one plane; ramps and platforms never move; webcam tested only with a simulated camera | README "Limitations" |

## Media

Captured from the production build (`npm run build && npx vite preview --port 4173`) in headless Chrome 154 with
SwiftShader WebGL, light theme. Scripts are in `research/airforge/capture/`.

- `overview.mp4` and `overview-poster.webp`: `record.mjs` draws a ramp, a ball, and a platform with real mouse
  events, presses D, waits, and presses Clear so the clip loops. The page clock runs at 0.4× so software
  rendering keeps up; frames are re-timed by the same factor when encoding, so the clip plays at real speed.
- `unclear-stroke.webp`: `stills.mjs` at device scale factor 2, cropped to x 360–1080 and y 400–850 (CSS pixels).
- `funnel.webp` (2048 × 1280) and `cover-1344.webp` / `cover-672.webp`: the 2× Funnel capture from `stills.mjs`, resized.
