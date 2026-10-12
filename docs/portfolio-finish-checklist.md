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

- [ ] Shared interface: consistent crest/favicon, 44px touch controls, clear keyboard
  focus, stateful theme label, delayed legible tooltips, searchable index with clear
  action and correct focus return; no overflow at 320/390/768/1440px.
- [ ] Avatar surroundings: preserve hero.js and avatar assets byte-for-byte; keep
  full size, rendering resolution, movement, gold/materials/red/blue and effects.
  Margin drawings respond to input without covering the sculpture. Hidden and
  off-screen drawings pause; reduced motion retains a considered static drawing.
- [ ] Slider: content, counter, links, focus and visible selection agree through
  rapid reversals, wheel/key/button/drag interruption and bounds. A selected card
  lands precisely at the reading notch. Mobile swiping and programmatic selection
  use the same center; first/last cards can center. Touch vertical scrolling works.
- [ ] Project illustrations: inspect and tune all eight separately. Each action
  has a distinct, finite, labeled result and reset; switching projects cancels stale
  state. Text is legible on mobile and every image is marked as an illustration.
- [ ] Contact: repeat copies restart feedback duration; success and failure are
  announced; keyboard focus and touch targets work; concise existing copy retained.
- [ ] AgentCrucible: hierarchy, diagram, demo, evidence/caption, links, mobile review.
- [ ] AirForge: hierarchy, diagram, evidence/caption, links, mobile review.
- [ ] Shipgate: hierarchy, diagram, demo, evidence/caption, links, mobile review.
- [ ] Recall: hierarchy, diagram, demo, evidence/caption, links, mobile review.
- [ ] Spanforge: hierarchy, diagram, evidence/caption, links, mobile review.
- [ ] LocalPulse: hierarchy, diagram, evidence/caption, links, mobile review.
- [ ] Ghost Notetaker: hierarchy, diagram, evidence/caption, links, mobile review.
- [ ] MoltDAO: hierarchy, diagram, evidence/caption, links, mobile review.
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
