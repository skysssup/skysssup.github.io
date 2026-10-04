# aakashdahal portfolio v3 — design spec

Status: approved and built. Where the build departed from the draft, the note says so.

## 0. Audit of the current site

**Keep (it works and is tested)**
- Plain HTML/CSS/JS on GitHub Pages, no build step, every asset self-hosted, Lenis vendored.
- `site.js` theme logic: saved choice, OS sync, cross-tab sync, theme-color meta (7 tests).
- Gear Two state machine (flash → glitch → settle, cancellable, reduced-motion path) and the circle theme reveal via View Transitions (6 tests).
- The pixel cat: original 16×16 sprites, outline derivation, chase/alert/sleep/scratch state machine (5 tests).
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
| `/` | Hero (stipple sculpture, intro, Essentially, theme index, contact), selected work (4), contact |
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
| Title S | Sans 500 18/24 | Section heads, project names in lists |
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

The accent only marks interactive or active things: links on hover, the current page, pressed filters, focus rings, the words on the figure. Lines are ink at 10% opacity. Blue because it's the blueprint color. Gear Two swaps the accent and the figure's ink to red and changes nothing else.

## 6. Components
Sheet frame and grid · header (name → home, Work, Contact, Gear Two toggle, Kathmandu time with UTC offset, light switch) · panel (1px border, mono head, sans body) · theme index (3 links with counts) · project card (16:10 media, meta row, name, tagline) · project row for `/work` (number, name, tagline, themes, stack and visibility, thumbnail) · filter bar (toggle buttons with counts, `aria-pressed`, URL state) · case-study header (breadcrumb, title, one-liner, meta `<dl>`: role, status, themes, stack, repo) · media figure (numbered "Fig. N" with caption; image with WebP srcset, muted looping video with poster and a pause button, terminal block with real output, click-to-load demo frame) · sticky section index with scrollspy · prose section · decisions list (decision, why, cost) · numbers panel (verified facts) · diagram (inline SVG drawn in the site's type and colors, follows the theme and Gear Two) · previous/next project · contact block · footer (©, source link, motion toggle) · skip link · cat · 404.

Arrows appear only where they carry meaning: ↗ marks a link that leaves the site.

## 7. Hero engine (`js/hero.js`, WebGL2)
- **Offline preparation, committed with its script.**
  - A depth map of the avatar from a monocular depth model (Depth Anything V2 Small, Apache-2.0).
  - A figure mask (statue, wings, caduceus; the clouds fade out; the starfield is dropped).
  - A tone map from luminance with local contrast.
  - All three are packed into one PNG of about 150 KB or less.
- **Points.**
  - Blue-noise threshold stippling on the tone map inside the mask, so shadows read as dense dots and lit stone as sparse dots, like an engraving.
  - About 50k dots on desktop and 22k on mobile.
  - Each dot gets its z from the depth map and a normal from the depth gradient.
- **Render.**
  - One draw call of round anti-aliased dots. Dot size follows depth and Lambert light from the upper left, which is what makes it read as a sculpted object rather than a flat dither.
  - Ink is black on light, warm white on dark, red in Gear Two. DPR is capped at 2.
- **Motion.** Slow yaw sway of ±16° over about 14 s and pitch of ±4°. Cursor tilt runs through a critically damped spring. All per-dot animation lives in the vertex shader.
- **Blink.** Hash-seeded per dot. About 1.5% of dots are off at any moment, for 80–240 ms each. Gear Two doubles the rate and adds a double-pulse heartbeat to dot size.
- **Cursor.** Dots within about 90 px are pushed out in screen space and lifted toward the viewer. The strength eases in and out.
- **Click or tap ripple.** Up to 4 rings at about 900 px/s, decaying over 1.2 s. They displace dots radially and in z.
- **Load.** Dots settle from a scattered sphere into the figure, center first, in about 1.4 s.
- **Words.** As built: the eight project names run around a tilted 3D ring that circles the torso, in Fragment Mono caps in the accent color (ink in Gear Two). Glyphs in front get a paper-colored halo that knocks the dots out behind them; glyphs behind read mirrored and dim, and disappear where the figure covers them. Names are always whole. Hovering a theme on the home page lights its projects and dims the rest.
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
- **Text is never hidden waiting for scroll.** Only media frames fade in when first visible.
- **Smooth scroll.** Lenis with lerp 0.1. Touch uses native scrolling. Anchors are offset by the header height. Demos get `data-lenis-prevent`.
- **Page transitions.** Cross-document View Transitions: a 250 ms fade of `main` while the header stays fixed. Chromium only; elsewhere pages load normally.
- **Reduced motion.** It applies when the OS asks for it, or when the footer motion toggle is set (saved locally). Smooth scroll, entrances, blinking, ripples, video autoplay, Gear Two effects, and the cat all stop.

## 9. Gear Two
- **Control.** A bordered mono button in the header center labeled "Gear Two" (no brackets), with `aria-pressed`. The label never changes.
- **Turning it on.**
  - 0–90 ms: a white flash at 70%.
  - 90–650 ms: glitch. The palette switches to red, text gets a 1.5 px red/cyan split, and the hero and header show three frames of 1–3 px horizontal slice offsets.
  - 650–1050 ms: settle. A damped 3 px shake.
  - There are no scan lines, embers, or vignette.
- **While it's on.** The figure is red, it has a heartbeat, and it rotates 1.6× faster. The accent is red everywhere.
- **Turning it off.** A 300 ms reverse glitch.
- **Persistence.** It lasts for the session (`sessionStorage`), so opening a case study keeps it. Turning the lights on exits Gear Two, as it does today.

## 10. Light switch
- **Placement.** A small switch in the header, right edge.
- **Saving the choice.** The choice is saved, it follows the OS until set, and it syncs across tabs (the existing tested logic).
- **Reveal.** A soft-edged circle grows from the switch over 850 ms (View Transitions). Without the API, the colors cross-fade over 200 ms. Under reduced motion it's instant.

## 11. Cat
- **Behavior.** It keeps the original sprite and state machine, tuned for a calmer chase. It runs to the cursor, sits, blinks, sleeps when idle, and scratches the wall the cursor left through.
- **Hidden** on touch-only devices and under reduced motion.
- **Never interferes.** It ignores pointer events and never covers the header.

## 12. Accessibility (WCAG 2.2 AA)
- axe-core reports 0 violations on every page in light, dark, and Gear Two, at 1440 and 390.
- Focus ring: 2 px accent, 2 px offset. Skip link. One `h1` per page. Ordered headings. Landmarks.
- Toggles use `aria-pressed`.
- Autoplaying video has a pause control. The motion toggle covers WCAG 2.2.2 for the hero.
- All text meets 4.5:1, including in Gear Two.

## 13. Performance budget (gzip)
- **Per page.**
  - HTML ≤ 25 KB, CSS ≤ 20 KB, JS ≤ 45 KB, Lenis about 9 KB.
  - Fonts: 3 files totaling about 59 KB, 2 of them preloaded.
  - Hero data ≤ 200 KB, home only.
- **Media.** Images are lazy-loaded with fixed dimensions (no layout shift). Videos use `preload="none"` with a poster. Demos load on click.
- **Targets.** Lighthouse mobile: 95+ performance, 100 accessibility, 100 best practices, 100 SEO. LCP under 2 s. CLS under 0.02.

## 14. Meta
Each page gets a unique title and description, a canonical URL on `https://skysssup.github.io/`, `og:*` and `twitter:card=summary_large_image`, and a 1200×630 share image rendered from the page's own design by a committed script. Plus JSON-LD `Person` on home. Moving to aakashdahal.fun later is a one-line origin change, guarded by a test.

## 15. Testing and QA
- **Node tests (`node --test`).**
  - Hero math: projection, ripple, blink schedule, stipple sampler, word layout.
  - Gear Two, theme, motion preference, cat, filter ↔ URL state, scrollspy.
  - Content integrity on every page: meta and OG tags, one `h1`, alt text, internal links resolve, assets exist, banned-word list, no uppercase paragraphs.
- **Playwright.**
  - All 11 pages × 4 widths × 3 modes: zero console errors, no horizontal overflow, the grid-alignment assertion, and screenshots.
  - Interactions: Gear Two, the theme reveal, filters and URL, keyboard paths, video pause, demo loading, the cat, and the reduced-motion paths.
  - An internal and external link check.
- **axe-core** in every mode.
- **CI.** GitHub Actions runs all of it on every push to `main`.
- **Visual loop.** After each major change, 132 screenshots go onto contact sheets. I critique and fix, and repeat until nothing is off.

## 16. Writing rules (all copy)
- First person. Plain technical English. Every sentence carries a fact, a mechanism, or a reason.
- Numbers and module names come from the code and are verified.
- No marketing adjectives, no invented users, metrics, employers, or credentials, no "not just X but Y", no exclamation marks.
- The case studies keep the repos' own candor about limits.

## 17. Draft "Essentially" statement (needs your edit or OK)
> I build instruments for AI systems: a harness that catches an agent refunding twice, a proxy that traces every LLM call, and a gate that scans what a coding agent is about to push. Also physics software you can draw into. Next: reinforcement learning and robotics.

## 18. Defaults I'll take unless you say otherwise
- Selected work on home = the 4 public projects.
- Live AirForge and Shipgate demos hosted at `/work/<slug>/demo/`, loaded only on click.
- MoltDAO stays, last, labeled "Experiment", written candidly as what the experiment taught.
- Private projects show only their GitHub one-liner until you approve a per-fact disclosure list for each.
- No dates, because git history starts on Sep 29, 2026 for all eight repos.
