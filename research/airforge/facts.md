# AirForge: facts behind the case study

Repository `skysssup/airforge` at `9c451f0` (Release 2.0.0). Every number and mechanism on `/work/airforge/`
is listed with where it was checked. Rows first checked at `72d491b` (1.2.0) were checked again at `9c451f0`
where 2.0 changed them. Commands ran with Node 24.18.0.

## Numbers panel

| Claim | Verified by |
|---|---|
| 252 Vitest tests (unit, component, headless physics), all passing | `npx vitest run`: `Test Files 25 passed (25)`, `Tests 252 passed (252)` |
| 16 Playwright browser tests, run by CI on every push | `npx playwright test --list --project=chromium`: `Total: 16 tests in 4 files`; `.github/workflows/ci.yml` job `browser` runs `npm run test:e2e` on pushes to `main` and on pull requests; CI run 37197188458 for `9c451f0` passed |
| 8 examples, each outcome checked in a headless Rapier world | `src/examples.ts` `EXAMPLES` (8 entries); `src/examples.test.ts` `describe('what each example does after Drop')` has one test per example |
| 1/120 s fixed physics step, the same in the browser and in tests | `src/physics/world.ts:31` `TIME_STEP = 1 / 120`, used by `src/render/PhysicsWorld.tsx` (`<Physics timeStep={TIME_STEP}>`) and `src/test/headlessWorld.ts` (`world.timestep = TIME_STEP`) |
| 40 objects per scene; files over 512 KB refused | `src/physics/params.ts:56` `MAX_OBJECTS = 40`; `src/io/schema.ts:31` `MAX_JSON_BYTES = 512_000` |

## Body

| Claim | Verified by |
|---|---|
| A drawn circle sets the ball radius, 0.15 to 1.5 units | `src/physics/params.ts:37-38`; `src/scene/objects.ts` `objectFromRecognition` clamps `drawnRadius` |
| Rectangles keep their tilt | `src/scene/objects.ts` `objectFromRecognition`: the longest edge sets `rotationZ` |
| Smooth bends and waves become curved tracks | `src/shapes/recognize.ts` `detectCurve`; `src/scene/objects.ts` `curveCenterline`, `objectFromRecognition` |
| Unclear strokes stay dashed until the user chooses | `src/store/appStore.ts` `endStroke` sets `pending`; `src/ui/PendingStrokePicker.tsx` offers Ramp, Ball, Platform, Curve, Discard (the Fig. 4 still was captured at 1.2.0, before Curve) |
| A selected shape can be dragged, nudged, turned, or copied, each one undo step | `src/store/appStore.ts` `beginMove`/`moveBy`/`endMove` (one `commit` per drag), `nudgeSelected`, `rotateSelected`, `duplicateSelected`; `src/store/appStore.test.ts` "drags a shape as one undoable edit", "nudges, rotates, and duplicates, one undo step each" |
| Motion marks: a dot every 0.1 s; one ball's speed and height | `src/render/PhysicsWorld.tsx:29` `STROBE_STEPS = Math.round(0.1 / TIME_STEP)`, dots laid in `useAfterPhysicsStep`; `src/physics/motion.ts` `readBall`, `followedBall`; `src/ui/MotionReadout.tsx` |
| Copy link packs the scene into a URL | `src/io/shareLink.ts` header: deflate-raw, base64url, `#scene=` fragment, same validation as files |
| Drop, Restart, Freeze behavior | `src/store/appStore.ts` `drop` (`releasedFrom`), `restart`, `freezeBalls` |
| Eight examples open from a menu or a `?example=` link; Curve Race pits a curve against a straight ramp | `src/examples.ts`; README "Examples"; `src/examples.test.ts` "Curve Race: the ball on the curve reaches its post first, rolling or sliding" |
| Webcam: raise index finger to draw, pinch to finish, open palm cancels | `src/hand/gestures.ts` `classifyRawGesture` (`draw`, `pen_up`, `erase`) |
| Mouse and touch points kept as drawn, webcam points smoothed | `src/stroke/capture.ts:1-5,36-46` (`SMOOTH_WINDOW = 4` applies only to `source === 'webcam'`) |
| A drag within 6 px is a click that selects | `src/store/appStore.ts:66` `TAP_SLOP = 6`; `endStroke` calls `selectAt` when `isTap` |
| Recognizer order curve, line, circle, rectangle; geometric tests, no model | `src/shapes/recognize.ts:1-8` (header comment), `recognizeStroke` |
| Curve: open, bends 12% of the chord to one side or 5% to both, no corner over 75° after ignoring wobbles under 6 px | `src/shapes/recognize.ts:77-86` (`CURVE_OPENNESS`, `CURVE_BOW_RATIO`, `CURVE_SWING_RATIO`, `MAX_CURVE_TURN`, `CURVE_OUTLINE_TOLERANCE`); the absolute minimums (25 px, 20 px) are left out of the page |
| Circle: spread of distances under 18% of the radius, at least 300° swept | `src/shapes/recognize.ts:164` `minCoverage = 5.24`, `:173` `radiusVariationCoeff < 0.18` |
| Rectangle: convex hull simplified to four corners, angles 70° to 110° | `src/shapes/recognize.ts:203-213` (`convexHull`, `approxPolyDP`), `:259` |
| Weak circle that is also a rectangle goes to the picker | `src/shapes/recognize.ts:86` (`circle.quality < 0.75`), `src/store/appStore.ts` `endStroke` |
| Colliders: boxes for ramps and platforms, spheres for balls, capsule chains for curves, floor and two walls | `src/physics/world.ts` `BOUNDARY`, `boxFor`, `capsulesFor` (neighbors share end spheres); `src/render/PhysicsWorld.tsx` `BallCollider`, `CapsuleCollider` |
| Balls cannot move in depth | `src/render/PhysicsWorld.tsx:284` `enabledTranslations={[true, true, false]}` |
| Moving balls write their position every frame; Freeze, Save, selection, Undo read it | `src/render/PhysicsWorld.tsx:265` `setLiveBallPose`; `src/physics/livePoses.ts` header; `src/store/appStore.ts` `objectsWithLivePoses` |
| 19 recognizer tests | `npx vitest run`: `src/shapes/recognize.test.ts (19 tests)` |
| Before 1.1.0 each step used the frame's duration; 1.1.0 fixed it at 1/60 s; 2.0 halved it because fast balls wedged in bends | `CHANGELOG.md` 1.1.0 and 2.0.0, Changed; `src/physics/world.ts:27-31` comment |
| At 1/60 s a fast ball overlapped the next capsules of a bend and was thrown back; 1/120 s ends it; a larger prediction distance costs speed | Headless sweep on a draft roller-coaster scene and Half-Pipe (scratch tests, not committed), with the shipped joint spacing: at 1/60 s the ball reversed at step 84 while touching three capsules 0.007–0.066 units deep, and passed the first valley in 1 of 10 nudged runs; at 1/120 s with Rapier's default prediction distance it passed in 10 of 10 at gravity 9.81, 20, and 30; at 1/60 s, raising the prediction distance to 0.02 or 0.05 also let it pass but lowered Half-Pipe's first swing peak from 0.05 to about −0.65 |
| Half-Pipe: each swing peaks about 20% lower above the bottom, damping included | Headless, `public/examples/half-pipe.json`: start 0.85, bottom −2.45, peaks 0.11, −0.44, −0.85, −1.18 (losses 22%, 21%, 20%, 21% of the height above the bottom) |
| Slow frames run several fixed steps; rendering interpolates between steps | `@react-three/rapier` `Physics`: delta clamped to 0.5 s, accumulator loop of `timeStep` steps, `interpolationAlpha`; `src/physics/world.ts:27` comment |
| Velocities are not stored by Undo or scene files | README "Limitations"; `src/io/serialize.ts` `objectsToSerialized` writes positions only |
| MediaPipe loads only when the webcam starts; frames stay in the browser | `src/ui/WebcamPanel.tsx:133` dynamic `import('../hand/landmarker')` after the camera opens; build output puts it in its own chunk (`landmarker-*.js`, 154 KB); README "Webcam" |
| Webcam mode needs jsDelivr and Google Cloud Storage | `src/hand/landmarker.ts:11-14` `WASM_CDN`, `MODEL_URL` |
| Hand tracking runs on the main thread | README "Limitations" |
| Example outcomes checked for the saved scene plus 8 (Funnel: 20) copies nudged by up to 0.02 units | `src/examples.test.ts:25-31` (`count = 8`, `(seed / 2147483647 - 0.5) * 0.04`), `:173` `variants(objects, 20)` |
| Three old examples did not do what they described | `CHANGELOG.md` 1.1.0, Fixed (Ramp & Ball, Double Ramp, Stairs Drop) |
| Ramp & Ball rests at (3.37, −2.53) headless and in three Chromium runs | Headless at `9c451f0`: `createHeadlessWorld` on `public/examples/ramp-and-ball.json`, all balls dynamic, 10 s and 20 s, printed `(3.3723, -2.5313)` both times. Chromium (headless Chrome, SwiftShader): the built app at `?example=ramp-and-ball`, Drop, 15 s, Save; the saved ball position was `(3.3723, -2.5313)` in all three runs |
| Of three Funnel runs in Chromium, one settled differently | Live site at `9c451f0`, `?example=funnel`, Drop, 20 s, Save: runs 1 and 2 identical (first balls `(-0.25, -3.65) (-1.12, -2.96)`), run 3 `(0.53, -3.02) (-0.55, -3.50)` |
| Funnel test requires all twelve balls in the box | `src/examples.test.ts` `Funnel: all twelve balls end up in the box` |
| Gesture after 3 identical frames; hand lost more than 2 frames cancels; jump over 160 px cancels | `src/hand/gestures.ts:13-14`; `src/stroke/capture.ts:13` `MAX_POINT_GAP = 160` |
| The demo loads AirForge 2.0.0 from GitHub Pages, deployed from `main` | `.github/workflows/deploy.yml` run 37197188491 for `9c451f0` passed; the live `/airforge/` page loads `assets/index-SqvszQlE.js`, the same file `npx vite build` produces at `9c451f0` |
| Live app download about 1.25 MB | gzip transfer from the live site: JS 1,192,954 B, CSS 4,645 B, fonts 31,176 + 23,272 B, HTML 947 B |
| CI: tests, lint, build, Chromium browser tests | `.github/workflows/ci.yml`; `npm run lint`: `Found 0 warnings and 0 errors` |
| Bundle about 3.5 MB, 2.1 MB of it Rapier's WebAssembly as base64 | `npx vite build` at `9c451f0`: `index-SqvszQlE.js 3,507.41 kB │ gzip: 1,193.44 kB`; the largest base64 run in that file is 2,092,532 bytes and starts `AGFzbQEAAAAB` (the WebAssembly header) |
| Shapes in one plane; ramps, platforms, and curves never move; a ball loses a little speed at each curve joint; webcam tested only with a simulated camera | README "Limitations" |

## Media

Captured from the production build (`npm run build && npx vite preview --port 4173`) in headless Chrome 154 with
SwiftShader WebGL, light theme. Scripts are in `research/airforge/capture/`.

- `overview.mp4` and `overview-poster.webp`: `record.mjs` draws a ramp, a ball, and a platform with real mouse
  events, presses D, waits, and presses Clear so the clip loops. The page clock runs at 0.4× so software
  rendering keeps up; frames are re-timed by the same factor when encoding, so the clip plays at real speed.
- `unclear-stroke.webp`: `stills.mjs` at device scale factor 2, cropped to x 360–1080 and y 400–850 (CSS pixels).
- `funnel.webp` (2048 × 1280) and `cover-1344.webp` / `cover-672.webp`: the 2× Funnel capture from `stills.mjs`, resized.
