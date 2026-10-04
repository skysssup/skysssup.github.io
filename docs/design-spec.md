# aakashdahal portfolio v3 — design spec

Status: approved and built. Where the build departed from the draft, the note says so.

## 0. Audit of the current site

**Keep (it works and is tested)**
- Plain HTML/CSS/JS on GitHub Pages, no build step, every asset self-hosted, Lenis vendored.
- `site.js` theme logic: saved choice, OS sync, cross-tab sync, theme-color meta (7 tests).
- Gear Two state machine (flash → glitch → settle, cancellable, reduced-motion path) and the circle theme reveal via View Transitions (6 tests).
- Off-screen and background-tab pausing of canvases; reduced-motion handling.

**Rebuild**
- **Hero.** The avatar is not recognizable. Luminance is used as height, so bright sky reads as relief and the statue dissolves into noise. The word layer cuts words at cell edges ("TS/", "EERI", "NG/R"), which reads as random symbols. Canvas 2D also caps the dot count.
- **Copy copied from luffy.sh.** These lines are luffy.sh's text, verbatim or near it: "My passion is to push the boundaries of what is possible with AI…", "I build things. Mostly AI. Sometimes they work.", "Building AI systems that close the gap between humans and machines.", "[ Core threads of my work ]", "Reach out to me over here at:", the "Reality" button label. The typeface (Space Grotesk) is also luffy's. All of it goes.
- **Content rendered by JavaScript.** The project list, detail panel, and portfolio cards are built in `main.js`, so they don't exist without JS or for crawlers, and every reveal waits on IntersectionObserver. A full-page capture of the current home shows an empty work section. All content moves into HTML.
- **Typography.** Paragraphs are uppercase at 9–10px with tracking. That's hard to read, and the 84px statement contradicts "no giant headline words".
- **Elements without a purpose.** Scan-line overlay, vignette, ember particles, "+" marks on the grid, striped bars, eight per-project rainbow colors (which break the one-accent rule), a second dithered crop of the same avatar, the "08 projects in 2026" facts strip, and the 3D tilt on list rows. All removed.
- **/portfolio arch mark** made of project names. It's a second 3D object competing with the hero, and it's unreadable. It's replaced by `/work`, and `/portfolio/` redirects there.
- **Light switch** is a vertical tab on the right edge that overlaps content at 390px. It moves into the header.
- **Meta.** There are no Open Graph or Twitter tags, no canonical URLs, and no share images.

## 1. Principles
1. Every element earns its place: it informs, navigates, or demonstrates real work. Otherwise it goes.
2. Real evidence over adjectives: screenshots, recordings, terminal output, and demos from the actual repos.
3. Small, exact typography; one accent; a visible grid that the content actually obeys.
4. Motion explains state changes or shows the work. Everything has a reduced-motion equivalent.
5. Content is HTML first. JavaScript enhances and never gates reading.

## 2. Site map
| URL | Contents |
|---|---|
| `/` | Hero (stipple sculpture, intro, Essentially, theme index, Fig. 0 readout), selected work (4), contact. Every page ends on the footer: the colophon (the site's own numbers) and a closing line |
| `/work/` | All 8 projects, filter by theme (`?theme=ai-systems` etc., shareable; without JS all show) |
| `/work/<slug>/` | Case study ×8: `agentcrucible`, `airforge`, `shipgate`, `recall-ai`, `spanforge`, `localpulse`, `ghost-notetaker`, `moltdao` |
| `/404.html` | Small, on-grid, links home and to `/work/` |
| `/portfolio/` | Redirect to `/work/` (meta refresh + canonical) |

Themes, where a project can carry two:
- **AI systems:** AgentCrucible, Spanforge, LocalPulse, MoltDAO.
- **Developer tools:** Shipgate, Recall, Ghost Notetaker, Spanforge, LocalPulse.
- **Physics software:** AirForge.

Order: AgentCrucible, AirForge, Shipgate, Recall, Spanforge, LocalPulse, Ghost Notetaker, MoltDAO. Selected work on home shows the four public ones, because a reviewer can open their code.

## 3. Grid
- A drawing sheet. The outer frame and the major column lines are fixed 1px hairlines (`--line`) that stay put while content scrolls. Horizontal rules belong to sections and scroll with them.
- Desktop and laptop (≥1200): frame inset 24, 4 equal majors, content inset 16 from a line, 3 minor columns per major.
- Tablet (768–1199): frame 20, 4 majors, inset 12.
- Mobile (<768): frame 12, 2 majors, inset 12.
- Every block's left edge sits on a major line, on a minor line, or on the inset beside one. An automated check asserts this (±0.5px) at all four widths.
- 4px baseline. Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.

## 4. Type
Instrument Sans (400, 500) for reading and Fragment Mono (400) for labels, numbers, and controls. Both are SIL OFL and self-hosted (17 + 17 + 25 KB woff2).

| Role | Spec | Use |
|---|---|---|
| Title L | Sans 500 24/32, −1% | Page title. Largest size on the site |
| Title S | Sans 500 18/24 | Project names on plates and in lists (with the tagline as a second line at 400), contact values |
| Body | Sans 400 15/24, 64ch max | Case-study prose |
| Small | Sans 400 13/20 | Panels, cards, captions |
| UI | Mono 11/16 caps, +6% | Nav, buttons, panel heads |
| Label | Mono 10/16 caps, +6% | Meta, indices, figure numbers |

Sentence case everywhere except mono labels. Numerals for numbers. No text is set above 24px.

## 5. Color
| | Paper | Ink | Muted | Accent |
|---|---|---|---|---|
| Light | #FFFFFF | #0C0C0C (19.6:1) | #6A6A6A (5.4:1) | #1F3BFF (6.7:1) |
| Dark | #0B0B0C | #ECEBE8 (16.5:1) | #8F8F8F (6.1:1) | #8796FF (7.3:1) |
| Gear Two | #080707 | #F3F1F0 (17.9:1) | #A39A98 (7.3:1) | #FF3B30 (5.7:1) |

The accent only marks interactive or active things: links on hover, the current page, pressed filters, focus rings, the words on the figure. Lines are ink at 10% opacity. Blue because it's the blueprint color. Gear Two swaps the accent and the figure's ink to red, tints the sheet lines red, and gives the figure a glow and a heartbeat (§9); nothing else changes.

## 6. Components
Sheet frame and grid · header (name → home, Work, Contact, Gear Two toggle, Kathmandu time with UTC offset, light switch) · panel (the one bordered box, used only for Essentially: 1px border, a mono head on a single rule, sans body) · theme index (3 links with counts) · plate (selected work: a 16:10 figure on a hairline, or the stack between two hairlines when there is no screenshot; a mono plate line, `Plate 01 · AI systems · Public`; the title at 18/24 with the tagline as the second line of the same block. Wide and narrow plates alternate and mirror from band to band; hover turns the title accent and moves its arrow 3 px) · project row for `/work` (opened by one hairline: the number hanging in the first column, the title and tagline as one block at 18/24, themes, stack, and visibility in mono, the thumbnail in the last column) · filters (mono words with counts, `aria-pressed`, URL state; the pressed one in the accent and underlined) · search (one field on a single rule, with a Clear link) · view toggle (two words, List and Grid) · case-study header (breadcrumb, title, one-liner, mono links into the page and to the source; facing it, a running head of mono lines from the meta `<dl>`: role, status, themes, stack, repo) · media figure (on a hairline, or between two when it holds no picture; "Fig. N" hangs in the first column beside a caption of at most 44ch on wide screens and sits above it on narrow ones; image with WebP srcset, muted looping video with poster and a pause tab, terminal block with real output, click-to-load demo frame) · sticky section index with scrollspy · prose section · decisions list (decision, why, cost; numerals hang in the first column on wide screens) · numbers (verified facts as a mono list under a short rule in the aside) · diagram (inline SVG drawn in the site's type and colors, follows the theme and Gear Two) · pager (two lines of type, Previous and Next hanging in the first column, each title with →) · contact (one band under the section's rule: the mono title and the Kathmandu time line, then three lines whose mono labels hang right-aligned in the first column and whose values sit at 18/24; ↗ after X and GitHub; Copy is a mono text link that reads Copied) · footer, the sheet's sign-off (on every page: a rule, the colophon with one paragraph of notes, the five rules with their numerals hanging in the first column, and six measured numbers hanging the same way; then one closing line with name, Kathmandu time, year, source, design spec, back to top, and the motion toggle; then the rule that closes the sheet, below which the sheet lines stop) · skip link · 404.

Arrows appear only where they carry meaning: ↗ marks a link that leaves the site; ↓ leads into a page section;
→ opens a project or destination; ↑ returns to the top.

### Navigation and browsing

- The home introduction has an immediate link to selected work and a GitHub link; the bio and Essentially copy stay unchanged.
- The header's site index is a searchable native dialog containing static page and project links. `/` and `Ctrl/Cmd+K` open it; arrows browse results, Enter opens a result, and Escape closes it. Focus stays inside and returns to the opener. Background scrolling is locked while it is open.
- Work search matches all query words against existing names, themes, taglines, visibility, and stacks. `?theme=…&q=…` is shareable; browser Back and Forward restore it. An empty state offers a reset rather than leaving an unexplained blank page.
- The work index offers list and grid layouts with a saved local preference. Mobile list rows put a thumbnail alongside the facts to make all eight projects easier to scan; grid view keeps larger visuals. Image source sizes follow the chosen layout.
- The case-study index stays available on mobile and tablet as a sticky, horizontally scrollable row. The reading progress indicator follows the article, and section anchors account for both sticky bars.
- Below the hero, feedback is colour alone: links, titles, and controls turn the accent over 200 ms, and an arrow that opens something moves 3 px. Filtering, searching, and switching views change the list at once.
- A typographic card uses a project's existing name and stack when no cover exists. It does not imitate a product screenshot or introduce a new project description.

## 7. Hero engine (`js/hero.js`, WebGL2)
- **Offline preparation, committed with its script.**
  - A depth map of the avatar from a monocular depth model (Depth Anything V2 Small, Apache-2.0).
  - A figure mask (statue, wings, caduceus; the clouds fade out; the starfield is dropped).
  - A tone map from luminance with local contrast.
  - All three are packed into one PNG of about 150 KB or less, plus a 448 px color map (WebP, about 22 KB).
- **Points.**
  - Blue-noise threshold stippling on the tone map inside the mask, so shadows read as dense dots and lit stone as sparse dots, like an engraving.
  - About 50k dots on desktop and 22k on mobile.
  - Each dot gets its z from the depth map and a normal from the depth gradient.
- **Render.**
  - One draw call of round anti-aliased dots. Dot size follows depth and Lambert light from the upper left, which is what makes it read as a sculpted object rather than a flat dither.
  - Ink is black on light, warm white on dark, red in Gear Two. DPR is capped at 2.
  - **Color.** Each dot also carries the avatar's color around it (`assets/hero/color.webp`: the image blurred by 4 px, since dots sit in its shadows, with saturation lifted). The shader keeps the hue and sets the brightness from the paper (0.46 on light, 0.84 on dark), weighted by chroma: marble has none and stays ink; the wings, the caduceus, the hair, and the clouds keep their gold, peach, and blue. The map's alpha (above an opaque floor of 128, so browsers' premultiplication cannot erase the color) marks the image's own sparkles, which swell and brighten on a slow cycle of their own. Gear Two drops all color for red.
- **Motion.** Slow yaw sway of ±16° over about 14 s and pitch of ±4°. Cursor tilt runs through a critically damped spring. All per-dot animation lives in the vertex shader.
- **Lighting.** Each dot carries a surface normal derived at load from the depth map (central differences, one-sided at the mask edge, tilt capped so no normal lies flat). The vertex shader rotates it with the figure and lights it from the upper left: lit stone gets smaller, fainter dots; stone turning away gets heavier ones; grazing edges a little heavier still. This is what changes as the figure turns, and it is what makes the dots read as one solid.
- **Sheen.** At each turn of the sway and once when the assembly finishes (§8), a band of light crosses the figure and a burst of stars fires on its lit side. The CPU only works out when a turn has passed (`sheenPhase(clock)`, exported and unit-tested) and sets one `vec4 u_sheen` per frame: the eased progress of the sweep, its direction, the burst's number, and its age. Everything per dot happens in the vertex shader: the band is a Gaussian across the screen (slanted slightly, 3.5% of the figure's box wide) weighted by `pow(max(n.z, 0), 2)` of the rotated normal, so it reads as light on a surface and not as a stripe on a flat image; it shifts a dot toward the sheen colour and enlarges it by up to 35%. The stars are chosen by a hash of the dot and the burst number among dots that face the light and the viewer, about 40 a burst whatever the dot count. A star's sprite grows to hold a four-point cross, shaped in the fragment shader from `gl_PointCoord` as the brighter of its disc and two tapering arms, with a core in the sheen's brightest colour. Its colours are CSS custom properties per mode (`--figure-sheen`, `--figure-sheen-core`, `--figure-star`).
- **Blink.** Hash-seeded per dot. About 1.5% of dots are off at any moment, for 80–240 ms each. Gear Two doubles the rate and adds a double-pulse heartbeat to dot size.
- **Cursor.** Dots within about 90 px are pushed out in screen space and lifted toward the viewer. The strength eases in and out.
- **Click or tap ripple.** Up to 4 rings at about 900 px/s, decaying over 1.2 s. They displace dots radially and in z.
- **Load.** Dots settle from a scattered sphere into the figure, center first, in about 1.4 s.
- **Words.** As built: the eight project names run around a tilted 3D ring that circles the torso, in Fragment Mono caps in the accent color (ink in Gear Two). Glyphs in front get a paper-colored halo that knocks the dots out behind them; glyphs behind read mirrored and dim, and disappear where the figure covers them. Names are always whole. Hovering a theme on the home page lights its projects and dims the rest.
- **Readout.** A mono line under the caption shows the engine's state: yaw, pitch, JS milliseconds per frame (an exponential average), and the heartbeat's tempo in Gear Two. It updates about six times a second and is hidden from assistive technology.
- **Budget and fallbacks.**
  - Under 2 ms of JS per frame. The CPU only updates uniforms and the word layer.
  - Pauses when off-screen or in a background tab.
  - Reduced motion renders one finished still frame.
  - Without WebGL, a static stipple PNG from the same pipeline is shown.
  - The canvas is `aria-hidden`, and its container is `role="img"` with alt text.

## 8. Motion rules
- **Easing.** `--ease-out: cubic-bezier(.16,1,.3,1)` for entrances. `--ease-in-out: cubic-bezier(.65,0,.35,1)` for mode changes.
- **Durations.** 120 ms press, 200 ms hover, 400 ms panel, 850 ms theme reveal, 1.1 s for the whole Gear Two sequence.
- **Properties.** Only `transform` and `opacity` animate. Translations are 8 px at most. Stagger is 60 ms, across 6 items at most.
- **Home entrance.** Dots assemble, then the header and panels rise 6 px with a stagger. Other pages appear at once.
- **Text is never hidden waiting for scroll.** Only graphics wait: a section's rule draws itself from the left (900 ms), and a media frame wipes in from the left (800 ms). Each happens once, the first time the element is 20% in view (`[data-reveal]` → `.is-seen`), only with JavaScript and full motion; without either, everything is simply there.
- **Sheen.** Each time the sway turns (every 7 s on alternating sides, 4.4 s in Gear Two, where the sway runs faster) and once when the dots finish assembling, a thin band of light crosses the figure in 1.1 s on `--ease-in-out`, travelling the way the figure was turning (the assembly's sweep runs opposite to the first turn, so the directions alternate from the start). At the same moment about 40 dots on the lit side flare to 2.2× as four-point stars within 120 ms and fade over 600–900 ms, each after its own delay of up to 250 ms, so many small lights come on rather than one flash. Light paper: a blue band (`#2C62FF`) with a blue-white core (`#9DB8FF`), blue stars. Dark paper: cyan (`#38D9FF`) with a `#BFF4FF` core, stars `#8AE8FF`. Gear Two: §9. Cursor tilt and touch drags never trigger it; only the base sway does.
- **Smooth scroll.** Lenis with lerp 0.1. Touch uses native scrolling. Anchors are offset by the header height. Demos get `data-lenis-prevent`.
- **Page transitions.** Cross-document View Transitions: a 250 ms fade of `main` while the header stays fixed. Chromium only; elsewhere pages load normally.
- **Reduced motion.** It applies when the OS asks for it, or when the footer motion toggle is set (saved locally). Smooth scroll, entrances, blinking, ripples, the sheen and its stars, video autoplay, and Gear Two effects all stop.

## 9. Gear Two
- **Control.** A bordered mono button in the header center labeled "Gear Two" (no brackets), with `aria-pressed`. The label never changes. While Gear Two is on, the button pulses a red halo in time with the heartbeat.
- **Turning it on.** One sequence, 1.05 s, choreographed in `js/motion.js` (phases on `<html data-phase>`), `css/site.css`, and `js/hero.js`:
  - 0–90 ms: a white flash at 70%, cut in hard and faded out over 160 ms once the palette turns. A 2 px red ring leaves the switch and grows past the far corner of the viewport over 0.9 s, fading as it goes.
  - 90–650 ms: glitch. The palette switches to red. Headings, panel heads, navigation, and the contact values get a 1.5 px red/cyan split; the header and every media frame show three frames of horizontal slice offsets; `main` jitters by 1–3 px. In the figure, horizontal slices shift, up to three tiles tear out of the statue and jump sideways with a thin red frame drawn where they land, two faint afterimages sit 2 px either side of the figure, and a ripple rolls out from the centre as the ink turns red.
  - 650–1050 ms: settle. A damped 3 px shake on the figure; the text split fades over 400 ms.
  - There are no scan lines, embers, or vignette.
- **While it's on.** The figure is red and has a heartbeat: a double beat every 0.9 s that pulses dot size, sets about 3% of dots white-hot at the peak, and breathes the ring's radius by 2%. A soft red glow sits behind the figure and pulses with the same beat. The accent is red everywhere, the sheet lines are red at 20%, and the figure rotates 1.6× faster. The sheen (§8) runs warm white (`#FFE9E0`, with a coral `#FF8A7A` fringe and coral stars), and each burst also tears one frame of the figure, so the light and the glitch read as one system.
- **One clock.** The heartbeat runs on `performance.now()` in the hero. When Gear Two turns on, `motion.js` writes `--beat-delay` on the root (minus the clock's position in the 0.9 s cycle), and every CSS pulse (glow, button) starts from that phase, so the page beats as one.
- **Turning it off.** A 300 ms reverse glitch (slices, tiles, afterimages); the tearing stops 140 ms after the palette comes back.
- **Reduced motion.** Everything above collapses to an instant palette switch: no flash, ring, split, slices, tiles, heartbeat, or glow animation.
- **Persistence.** It lasts for the session (`sessionStorage`), so opening a case study keeps it. Turning the lights on exits Gear Two, as it does today.

## 10. Light switch
- **Placement.** A small switch in the header, right edge.
- **Saving the choice.** The choice is saved, it follows the OS until set, and it syncs across tabs (the existing tested logic).
- **Reveal.** A soft-edged circle grows from the switch over 850 ms (View Transitions). Without the API, the colors cross-fade over 200 ms. Under reduced motion it's instant.

## 11. Accessibility (WCAG 2.2 AA)
- axe-core reports 0 violations on every page in light, dark, and Gear Two, at 1440 and 390.
- Focus ring: 2 px accent, 2 px offset. Skip link. One `h1` per page. Ordered headings. Landmarks.
- Toggles use `aria-pressed`.
- Autoplaying video has a pause control. The motion toggle covers WCAG 2.2.2 for the hero.
- All text meets 4.5:1, including in Gear Two.

## 12. Performance budget (gzip)
- **Per page.**
  - HTML ≤ 25 KB, CSS ≤ 20 KB, JS ≤ 45 KB, Lenis about 9 KB.
  - Fonts: 3 files totaling about 59 KB, 2 of them preloaded.
  - Hero data ≤ 200 KB, home only.
- **Media.** Images are lazy-loaded with fixed dimensions (no layout shift). Videos use `preload="none"` with a poster. Demos load on click.
- **Targets.** Lighthouse mobile: 95+ performance, 100 accessibility, 100 best practices, 100 SEO. LCP under 2 s. CLS under 0.02.

## 13. Meta
Each page gets a unique title and description, a canonical URL on `https://skysssup.github.io/`, `og:*` and `twitter:card=summary_large_image`, and a 1200×630 share image rendered from the page's own design by a committed script. Plus JSON-LD `Person` on home. Moving to aakashdahal.fun later is a one-line origin change, guarded by a test.

## 14. Testing and QA
- **Node tests (`node --test`).**
  - Hero math: projection, ripple, blink schedule, stipple sampler, word layout.
  - Gear Two, theme, motion preference, filter ↔ URL state, scrollspy.
  - Content integrity on every page: meta and OG tags, one `h1`, alt text, internal links resolve, assets exist, banned-word list, no uppercase paragraphs.
- **Playwright.**
  - All 11 pages × 4 widths × 3 modes: zero console errors, no horizontal overflow, the grid-alignment assertion, and screenshots.
  - Interactions: Gear Two, the theme reveal, filters and URL, keyboard paths, video pause, demo loading, and the reduced-motion paths.
  - An internal and external link check.
- **axe-core** in every mode.
- **CI.** GitHub Actions runs all of it on every push to `main`.
- **Visual loop.** After each major change, 132 screenshots go onto contact sheets. I critique and fix, and repeat until nothing is off.

## 15. Writing rules (all copy)
- First person. Plain technical English. Every sentence carries a fact, a mechanism, or a reason.
- Numbers and module names come from the code and are verified.
- No marketing adjectives, no invented users, metrics, employers, or credentials, no "not just X but Y", no exclamation marks.
- The case studies keep the repos' own candor about limits.

## 16. Draft "Essentially" statement (needs your edit or OK)
> I build instruments for AI systems: a harness that catches an agent refunding twice, a proxy that traces every LLM call, and a gate that scans what a coding agent is about to push. Also physics software you can draw into. Next: reinforcement learning and robotics.

## 17. Defaults I'll take unless you say otherwise
- Selected work on home = the 4 public projects.
- Live AirForge and Shipgate demos hosted at `/work/<slug>/demo/`, loaded only on click.
- MoltDAO stays, last, labeled "Experiment", written candidly as what the experiment taught.
- Private projects show only their GitHub one-liner until you approve a per-fact disclosure list for each.
- No dates, because git history starts on Sep 29, 2026 for all eight repos.
