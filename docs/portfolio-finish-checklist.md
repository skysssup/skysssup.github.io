# Portfolio finishing review

Baseline: `bd418ba838c5976c2a8a503eaa326ed743a4b9f9`, clean detached checkout,
remote main at the same commit. No repository AGENTS.md found. Latest Pages run
38233993307 succeeded; Site tests 38233993881 failed three obsolete assertions
about the restored avatar effects. Baseline unit suite: 97/97.

Reference observed in Chrome: hancore.dev/site/, idle and wheel selection,
click selection and arrow keys. Its strongest property is the connection between
the selection notch, drawings, annotations, and input feedback. Preserve our own
text-first work and Hermes artwork rather than borrowing its product images.

## Acceptance criteria, in order

- [x] Shared interface: consistent crest/favicon, 44px touch controls, clear keyboard
  focus, stateful theme label, delayed legible tooltips, searchable index with clear
  action and correct focus return; no overflow at 320/390/768/1440px.
- [x] Avatar surroundings: preserve hero.js and avatar assets byte-for-byte; keep
  full size, rendering resolution, movement, gold/materials/red/blue and effects.
  Margin drawings respond to input without covering the sculpture. Hidden and
  off-screen drawings pause; reduced motion retains a considered static drawing.
- [x] Slider: content, counter, links, focus and visible selection agree through
  rapid reversals, wheel/key/button/drag interruption and bounds. A selected card
  lands precisely at the reading notch. Mobile swiping and programmatic selection
  use the same center; first/last cards can center. Touch vertical scrolling works.
- [x] Project illustrations: inspect and tune all eight separately. Each action
  has a distinct, finite, labeled result and reset; switching projects cancels stale
  state. Text is legible on mobile and every image is marked as an illustration.
- [x] Contact: repeat copies restart feedback duration; success and failure are
  announced; keyboard focus and touch targets work; concise existing copy retained.
- [x] AgentCrucible: hierarchy, diagram, demo, evidence/caption, links, mobile review.
- [x] AirForge: hierarchy, diagram, evidence/caption, links, mobile review.
- [x] Shipgate: hierarchy, diagram, demo, evidence/caption, links, mobile review.
- [x] Recall: hierarchy, diagram, demo, evidence/caption, links, mobile review.
- [x] Spanforge: hierarchy, diagram, evidence/caption, links, mobile review.
- [x] LocalPulse: hierarchy, diagram, evidence/caption, links, mobile review.
- [x] Ghost Notetaker: hierarchy, diagram, evidence/caption, links, mobile review.
- [x] MoltDAO: hierarchy, diagram, evidence/caption, links, mobile review.
- [ ] Integration: opening/idle/both scroll directions/every selection/search/contact/
  appearance/light/reduced motion at desktop, tablet and narrow mobile sizes.
  Rebuild generated HTML; unit and full browser suites; direct stage commits;
  publish main, check CI and live asset version and browser behavior.

## Defects found

Header controls shrink to 28px on mobile. Theme tooltip always says Light even
when light is selected. Search opener lacks expanded state and query has no clear
action. Tooltip timing is immediate. Wheel content changes ahead of the visually
nearest card for discrete selections; drag can retain an old wheel timeout. Mobile
centering uses scrollIntoView and selection is delayed by a timer; edge cards lack
centering gutters. Drawing actions have no explanatory result; some action loops
continue indefinitely. Copy reset timers compete after repeated clicks. Reduced
motion hides every surrounding drawing. Work annotations are 8–9px. Case-study
mobile navigation and diagram/text/table overflow need individual inspection.

Record completed reviews and evidence here as stages finish.

## Completed surface review

The eight home illustrations now preview on entry/selection, replay by click or
keyboard, inspect actual nodes, and run distinct finite workflows. Core objects
move on the same clock as captions. Hidden/offscreen rendering pauses and resumes;
reduced motion retains static drawings and immediate manual outcomes.

The page palette remains dark by default and light only by explicit choice.
Avatar appearance changes do not recolor the page. Generic globes and redundant
workbench ornaments were removed; the original portrait renderer and assets have
no changes against the baseline.

Grok 4.7 build-fast workers implemented the diagram/reading pass and regression
coverage. Parent review corrected mobile navigation, scene timing, endpoint
centering, visibility lifecycle, and replay. A third worker could not connect;
its assignment was completed locally.

All eight case pages were inspected in fresh desktop captures. Narrow/tablet
checks cover readable diagram stages, section navigation, contained overflow,
and evidence controls. The six shorter pages remain project notes; their
workflow illustrations use existing public descriptions and do not imply new
implementation evidence or customer use.

Validation so far: 97 unit checks; 20/21 initial focused browser checks, with the
remaining workflow test corrected to navigate the visible wheel using Home.
All eight workflow action/reset/cancellation checks then passed, as did automatic
entry preview, pointer replay, keyboard replay, and reduced-motion static state.
Full suite and publication are recorded after completion below.

## Interactive work pass — 2026-10-14

Eight local illustration models now drive the actual SVGs: injected call faults,
ramp incline and collision, limited diff preview rules, review intervals, parallel
trace spans, token sums, safe Markdown capture/copy, and majority votes. Native
inputs and buttons are keyboard accessible. Models reset on project changes;
notes and example data remain local, with no product or customer-use claims.

The stage and explanation share a desktop row. Tablet copy sits beneath the
stage; the mobile selector is shorter and drawings fit the viewport. Default
examples repeat only while visible, with a Pause/Play control. Editing a model
stops the canned example. Hidden/offscreen models pause and resume without a
time jump. Reduced motion produces immediate static results.

Grok 4.7 CLI workers produced the models, control styles, and browser tests.
Parent integration and review corrected the lifecycle, native select affordance,
note overflow, selector navigation in tests, and duplicated result presentation.
No avatar renderer, avatar assets, or black-hole renderer were changed.

Local validation: 107 unit checks; all five interactive browser checks; nine
existing finish checks, then the corrected offscreen check. The original ember
pixel test now samples successive native pointer moves during the spark lifetime;
its visual thresholds and avatar assertions are unchanged. Full CI is required
before marking publication verified.

Visual review covered all eight active drawings at desktop, plus mobile and
tablet AirForge and explicit light mode. It caught inherited reduced-motion
transforms placing the new ball outside the SVG; active models now use only
their own coordinates, and the browser test checks the ball's visible bounds.
Trace geometry and ticks now share one millisecond scale that fits the complete
request. Notes wrap at word/newline boundaries, with the full text retained in
the editable field and the copy action.
