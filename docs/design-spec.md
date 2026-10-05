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
| `/` | Hero (stipple sculpture, intro, Why the statue, theme index, Fig. 0 readout), selected work (4 plates), contact with the 24-hour dial. Every page ends on the same closing line |
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
| Title L | Sans 500 24/32 | Page title. Largest size on the site |
| Title S | Sans 500 18/24 | Project names on plates and in lists (with the tagline as a second line at 400), contact values |
| Body | Sans 400 15/24, 64ch max | Case-study prose |
| Small | Sans 400 13/20 | Notes, captions, list text. In Fragment Mono for code and measured figures |
| UI | Mono 11/16 caps, +6% | Nav, buttons, panel heads |
| Label | Mono 10/16 caps, +6% | Meta, indices, figure numbers |

Sentence case everywhere except mono labels. Numerals for numbers. No text is set above 24px.

The small rules that hold it together:
- Every vertical measure is on the 4 px baseline: line heights of 16, 20, 24, and 32, and spacing from the scale in §3. No measure compensates for a border.
- Letter-spacing only on mono caps. Numbers that change or stand in columns are tabular.
- Headings balance their lines; paragraphs wrap with `text-wrap: pretty`, and the generator ties the last three words of a run of copy so no block ends on a line of one or two words.
- Measure: 52–64ch for prose, 34–44ch for captions.
- `·` is the only separator, held to the word before it with a non-breaking space so it ends a line rather than starting one. Arrows follow §6, also after a non-breaking space.
- Text links are underlined 1 px in `--line-strong` at a 3 px offset and turn the accent on hover. Labels, numerals, and figures hang right-aligned in the first column, so the text beside them starts on the second column's inset.

## 5. Color
| | Paper | Ink | Muted | Accent |
|---|---|---|---|---|
| Light | #FFFFFF | #0C0C0C (19.6:1) | #6A6A6A (5.4:1) | #1F3BFF (6.7:1) |
| Dark | #0B0B0C | #ECEBE8 (16.5:1) | #8F8F8F (6.1:1) | #8796FF (7.3:1) |
| Gear Two | #080707 | #F3F1F0 (17.9:1) | #A39A98 (7.3:1) | #FF3B30 (5.7:1) |

The accent only marks interactive or active things: links on hover, the current page, pressed filters, focus rings, the words on the figure. Lines are ink at 10% opacity. Blue because it's the blueprint color. Gear Two swaps the accent and the figure's ink to red, tints the sheet lines red, and gives the figure a glow and a heartbeat (§9); nothing else changes.

**The figure's materials.** The sculpture is drawn in five materials, named per pixel by a material map (§7) and colored from a palette designed for each mode, in `css/site.css` as `--mat-<material>` (base) and `--mat-<material>-lit` (where the surface faces the light). Marble is the figure's ink, exactly, so the body keeps all of the engraving's contrast; the other four are the only places the figure carries color, and none of them is an interactive color.

| Material | Where | Light (base → lit) | Dark (base → lit) | Gear Two |
|---|---|---|---|---|
| Gold | wings, caduceus, hair, rubble in the clouds | #B8860B → #D4A017; the densest dots lean 45% toward ink, so it has bronze in its crevices | #F2C14E → #FFE08A | #FF9E80 → #FFC9B8, at 40% over red |
| Marble | the body | ink #0C0C0C | ink #ECEBE8 | ink #FF3B30 |
| Cloud | the bank under the statue | #C76B6B → #DC9A9A, rose deep enough for white paper | #F0A8B8 → #FFD3DD | red |
| Lightning | the strike at the statue's base | #1F7FD6 → #62ADEE | #55E6FF → #B8F5FF | red |
| Glint | small bright specks of sky on the wings | #2C62FF → #7F9DFF | #8AB4FF → #C4D8FF | red |

## 6. Components
Sheet frame and grid · header (name → home, Work, Contact, Gear Two toggle, Grid toggle, Kathmandu time with UTC offset, light switch) · panel (the one bordered box, used only for Why the statue: 1px border, a mono head on a single rule, sans body) · theme index (3 links with counts) · plate (selected work: a 16:10 figure on a hairline, or the stack between two hairlines when there is no screenshot; a mono plate line, `Plate 01 · AI systems · Public`; the title at 18/24 with the tagline as the second line of the same block. Wide and narrow plates alternate and mirror from band to band; each screenshot first appears as a stipple drawing of itself in the figure's ink and develops into the image the first time it is seen; hover turns the title accent and moves its arrow 3 px) · project row for `/work` (opened by one hairline: the number hanging in the first column, the title and tagline as one block at 18/24, themes, stack, and visibility in mono, the thumbnail in the last column) · filters (mono words with counts, `aria-pressed`, URL state; the pressed one in the accent and underlined) · search (one field on a single rule, with a Clear link) · view toggle (two words, List and Grid) · case-study header (breadcrumb, title, one-liner, mono links into the page and to the source; facing it, a running head of mono lines from the meta `<dl>`: role, status, themes, stack, repo) · media figure (on a hairline, or between two when it holds no picture; "Fig. N" hangs in the first column beside a caption of at most 44ch on wide screens and sits above it on narrow ones; image with WebP srcset, muted looping video with poster and a pause tab, terminal block with real output, click-to-load demo frame) · sticky section index with scrollspy · prose section · decisions list (decision, why, cost; numerals hang in the first column on wide screens) · numbers (verified facts as a mono list under a short rule in the aside) · diagram (inline SVG drawn in the site's type and colors, follows the theme and Gear Two) · pager (two lines of type, Previous and Next hanging in the first column, each title with →) · contact (one band under the section's rule: the mono title and a line with my time and what I am probably doing, then three lines whose mono labels hang right-aligned in the first column and whose values sit at 18/24; ↗ after X and GitHub; Copy is a mono text link that reads Copied; beside them, Fig. 1, my day on a 24-hour dial: midnight at the foot and noon at the top, the night stippled in between a sunrise and sunset worked out for the date, an accent hand for now, a mark for the visitor's own time, and a readout that follows the pointer round the face) · footer (on every page, one closing line on a rule: name, local time, year, source, design spec, back to top, and two quiet toggles, Grid and Reduce motion; then the rule that closes the sheet, below which the sheet lines stop) · construction grid (`G`, or Grid in the header and the footer, for the session: minor columns dashed and the insets dotted over the sheet, and a tag on whatever text the pointer rests on naming its role, size, face, and the line its edge sits on) · skip link · 404.

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
- **Offline preparation, committed with its script** (`tools/hero/build.py`).
  - The source is the 424 px GitHub avatar (kept as `tools/hero/avatar-424.jpg`; no larger original exists), upscaled 4× to 1696 px as an even blend of Real-ESRGAN x4plus, which sharpens edges, and Real-ESRNet x4plus, its PSNR-trained sibling, which invents no texture (both BSD-3-Clause). Checked by eye on the face and both hands: it sharpens what the render already shows and adds no features. Detail was limited by the source, not the shader, so this is where the pass starts.
  - A depth map from Depth Anything V2 Base (CC BY-NC 4.0) run at 1036 px and cached as 16-bit; it separates the eye sockets, the nose, the fingers of the fist, and the open hand from the clouds behind it.
  - A figure mask (statue, wings, caduceus, the outstretched arm and open hand; the clouds fade out; the starfield is dropped).
  - An ink map at 896 px. The image's own tone and local shadows lead, because they carry the features (eye sockets, nostrils, the open mouth); the depth surface lit from the upper left adds the turn of the form; contours come from the silhouette and from steps in depth (fingers against the palm, snakes against the staff); a floor keeps lit stone drawn, and a contrast curve sets features off the skin. Local contrast multiplies the ink by up to 1.6, so features get denser dots. Inside the face and hand zones (below) the ink is sharpened with an unsharp mask (1.5 px, 0.8), faded in over each zone's rim, so the eye socket, the open mouth, and the fingers stand off the stone. Quantised to 64 levels and stored as lossless WebP (about 88 KB).
  - A 448 px depth map (lossless WebP: red is depth, 0 outside the figure; green is detail, the smoothed local contrast) and a 448 px color map (WebP). All hero data is about 160 KB.
- **Points.**
  - Blue-noise threshold stippling on the ink map inside the mask, a little denser than one cell per CSS pixel (1.4 cells per pixel of the figure's width, 320 to 1200 cells across), so shadows read as dense dots and lit stone as sparse dots, like an engraving.
  - The face and both hands are three soft ellipses (`fine` in `hero.json`, `FINE` in `build.py`). On screens of 1.5 device pixels per CSS pixel or more, a cell inside one splits into four cells of a grid twice as fine, thresholded against the blue-noise tile at that scale, with dots 62% the size; over the outer 30% of the radius a cell splits with a probability that falls to zero, chosen by a hash, so the finer texture fades in without a seam. Below 1.5 a half-size dot is smaller than a pixel and only darkens the stone, so the grid stays as it is.
  - 93,201 dots at 1440 × 900, 127,340 at 1440 × 900 on a 2× screen (93,015 before the fine zones), and 25,707 at 390 wide; JS stays at 0.3–0.4 ms a frame.
  - Each dot gets its z and a surface normal from the depth map, smoothed inside the figure first so its 8-bit steps never terrace the lighting, a detail value that shrinks its dot by up to 18% (features are drawn with small dense dots, broad shadows with larger ones), and how far it lies from the figure's edge along its row, to the right and to the left, counted on the depth map's mask (`edgeDistances`): where a bit carried off by a sheen turns to crystal. The vertex is 32 bytes.
- **Render.**
  - One draw call of round anti-aliased dots. Dot size follows depth and Lambert light from the upper left, which is what makes it read as a sculpted object rather than a flat dither.
  - Ink is black on light, warm white on dark, red in Gear Two. DPR is capped at 2.
  - **Color.** Sampling the blurred avatar made the colors muddy (gold read brown-orange, the body picked up grey-cream and blue), so each dot now carries a material instead, and the palette is designed (§5). The material map (`assets/hero/color.webp`, 448 px, lossless) holds the material in red (index × 51, read at the nearest pixel, since an average of two indices would name a third), how strongly the pixel belongs to it in green (fading to zero within 2 px of a boundary, so an edge passes through ink instead of flickering between materials), and the image's own sparkles in alpha, above an opaque floor of 128 (browsers premultiply canvas pixels by alpha). It is built from zones named once on the avatar's layout and decided inside by color, warm or blue in CIELAB: a k-means over the whole figure splits it by lightness, because gold, marble, cloud, and glint overlap in every channel of this image. The vertex shader takes each material's base and lit colors from `uniform vec3 u_palette[5]` and `u_lit[5]`, set from the CSS custom properties, and moves between them with the lighting term, so gold flashes as the figure turns toward the light; on light paper the densest dots lean toward the ink. Marble carries no weight and stays ink. Gear Two keeps 40% of the colors (`u_tint` 0.4) over a palette that is red except for gold. Without the map every dot is ink.
- **Motion.** Slow yaw sway of ±16° over about 14 s and pitch of ±4°. Cursor tilt runs through a critically damped spring. All per-dot animation lives in the vertex shader.
- **Lighting.** Each dot carries a surface normal derived at load from the depth map (smoothed inside the figure by a normalised Gaussian, then central differences, one-sided at the figure's edge, tilt capped so no normal lies flat). The vertex shader rotates it with the figure and lights it from the upper left: lit stone gets smaller, fainter dots; stone turning away gets heavier ones; grazing edges a little heavier still. This is what changes as the figure turns, and it is what makes the dots read as one solid.
- **Sheen.** At each turn of the sway and once when the assembly finishes (§8), a band of light crosses the figure and a burst of stars fires on its lit side. The CPU only works out when a turn has passed (`sheenPhase(clock)`, exported and unit-tested) and sets one `vec4 u_sheen` per frame: the eased progress of the sweep, its direction, the burst's number, and its age. Everything per dot happens in the vertex shader: the band is a Gaussian across the screen (slanted slightly, 3.5% of the figure's box wide) weighted by `pow(max(n.z, 0), 2)` of the rotated normal, so it reads as light on a surface and not as a stripe on a flat image; it shifts a dot toward the sheen colour and enlarges it by up to 35%. The stars are chosen by a hash of the dot and the burst number among dots that face the light and the viewer, about 40 a burst whatever the dot count. A star's sprite grows to hold a four-point cross, shaped in the fragment shader from `gl_PointCoord` as the brighter of its disc and two tapering arms, with a core in the sheen's brightest colour. Its colours are CSS custom properties per mode (`--figure-sheen`, `--figure-sheen-core`, `--figure-star`).
- **Bits and crystals.** The light carries material with it. About 1.4% of dots, chosen by a hash per burst, leave the surface when the band passes them (the band's progress at the dot, back through the sweep's easing, gives the moment) and flow on in its direction at their own speed, 40–85% of the figure's width a second and never slower than it takes to reach the edge in 0.9 s, rising a little and wavering, so they stream behind the band. Each is drawn as a bright head with a tail along its path, as long as it moves in 20 ms. Where a bit reaches the figure's edge along its row it turns to crystal: an eight-point glint with a white heart, long arms on the axes and short ones on the diagonals, tipped in the sheen's colour so it shows on white paper as well as dark, which flares in 50 ms and fades over 550 ms while drifting outward; four in ten are full-size. The dot it left re-forms in place over the next 0.6 s. A sheen lasts its sweep and 2.3 s more. `vec4 u_flow` carries the share of bits, the sweep's length, whether the shine is the stronger one, and whether colours appear only behind the band (the opening).
- **Stronger on light and dark paper.** The band is 5% of the box wide instead of 3.5%, enlarges dots by up to 65%, and leaves an afterglow in its wake; 64 stars a burst instead of 40, at up to 2.8×; and the paper behind the figure takes the light: a soft ellipse in `--figure-glow` (`rgba(44, 98, 255, .2)` on light paper, `rgba(56, 217, 255, .2)` on dark) follows the band and rises and falls with the sweep, moved by a transform so it costs no layout. Gear Two keeps the narrower band without the glow, since its own red glow already beats behind the figure.
- **Opening.** When the page is opened (once a tab, again on a reload, never on the way back from another page of the site or under reduced motion; `sky-intro` in `sessionStorage`), the figure plays an opening instead of assembling (`introStep`, exported and unit-tested, holds its timing): it stands still in its ink alone, facing the viewer, for 2 s, so the still that covered loading is seen as a figure before anything moves; a slower shine (1.4 s, right to left) crosses it and leaves the materials' colours in its wake, so the gold arrives last on the wings; the ring fades in and the sway runs 2.5× until the figure has turned once and come back to the middle, with the turn's own shine at its far side. From light or dark paper the page then goes to Gear Two, the shockwave leaving the figure instead of the switch; 0.55 s after the palette turns, a shine crosses the red figure left to right, it turns once more the other way at 3.2×, with a shine at that turn, and the page comes back. About 10.5 s in all. Gear Two is switched without saving it (`switchGear(on, origin, transient)` in `js/motion.js`), so a visitor who leaves in the middle does not carry it to the next page. Any press, key, or scroll ends the opening at once: the colours and the ring arrive, and Gear Two goes back off, unless the press was on Gear Two or the lights, which then act on the page as it is. Scrolling the figure away, hiding the tab, or reducing motion ends it the same way. The still that covers loading is drawn at the same framing and foreshortening as the first frame, so it fades into it in place (300 ms); the opening's clock starts when that frame is on screen.
- **Blink.** Hash-seeded per dot. About 1.5% of dots are off at any moment, for 80–240 ms each. Gear Two doubles the rate and adds a double-pulse heartbeat to dot size.
- **Cursor.** Dots within about 90 px are pushed out in screen space and lifted toward the viewer. The strength eases in and out.
- **Click or tap ripple.** Up to 4 rings at about 900 px/s, decaying over 1.2 s. They displace dots radially and in z.
- **Load.** Dots settle from a scattered sphere into the figure, center first, in about 1.4 s, when the page is not playing its opening.
- **Words.** One line in the statue's voice runs around a tilted 3D ring that circles the torso: “I stole Apollo’s cattle on day one. Your agent won’t sneak one past me.” Hermes stole Apollo’s herd on the day he was born; the line turns the trickster on what my tools do, which is catch agents trying to slip something through. It lives in `tools/pages/site.json` as `ringLine`, reaches the engine as `data-ring` on `#figure` (the `aria-label` quotes it), and is set in Fragment Mono caps in the accent color (ink in Gear Two), repeated as many whole times as fit, each repeat closed by a middle dot, so a word is never cut. Glyphs in front get a paper-colored halo that knocks the dots out behind them; glyphs behind read mirrored and dim, and disappear where the figure covers them. Hovering or focusing a theme on the home page brightens the whole ring for 400 ms, the dim glyphs behind the figure most; under reduced motion nothing changes.
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
- **Home entrance.** The figure's opening (§7) when the page is opened, otherwise the dots assemble; the header and panels rise 6 px with a stagger. Other pages appear at once.
- **Text is never hidden waiting for scroll.** Only graphics wait: a section's rule draws itself from the left (900 ms), a case-study figure wipes in from the left (800 ms), and a plate's stipple drawing develops into its screenshot (a 1 s cross-fade). Each happens once, the first time the element is 20% in view (`[data-reveal]` → `.is-seen`), only with JavaScript and full motion; without either, everything is simply there.
- **Sheen.** Each time the sway turns (every 7 s on alternating sides, 4.4 s in Gear Two, where the sway runs faster) and once when the dots finish assembling, a band of light crosses the figure in 1.1 s on `--ease-in-out`, travelling the way the figure was turning (the assembly's sweep runs opposite to the first turn, so the directions alternate from the start). At the same moment about 40 dots on the lit side flare to 2.2× as four-point stars within 120 ms and fade over 600–900 ms, each after its own delay of up to 250 ms, so many small lights come on rather than one flash. Light paper: a blue band (`#2C62FF`) with a blue-white core (`#9DB8FF`), blue stars, and blue light on the paper. Dark paper: cyan (`#38D9FF`) with a `#BFF4FF` core, stars `#8AE8FF`, and cyan light on the paper. Gear Two: §9. Behind the band bits stream to the edge and turn to crystal (§7). Cursor tilt and touch drags never trigger it; only the base sway does.
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
- **While it's on.** The figure is red and has a heartbeat: a double beat every 0.9 s that pulses dot size, sets about 3% of dots white-hot at the peak, and breathes the ring's radius by 2%. A soft red glow sits behind the figure and pulses with the same beat. The accent is red everywhere, the sheet lines are red at 20%, and the figure rotates 1.6× faster. The figure's materials go red as well, except gold, which keeps 40% of a soft coral (`#FF9E80`), so the wings and the caduceus still read as metal. The sheen (§8) runs warm white (`#FFE9E0`, with a coral `#FF8A7A` fringe and coral stars), and each burst also tears one frame of the figure, so the light and the glitch read as one system.
- **Below the hero.** A pulse runs down each sheet line every other beat, a quarter of the way round from the line before; a drafting crosshair follows the mouse across the sheet and reads out its page coordinates and column; hovering a plate or a /work row shows its stipple drawing again, in red, over the dimmed screenshot; and the dial's hand beats with the heart. None of it runs under reduced motion.
- **Tears.** The figure keeps glitching for as long as Gear Two is on, in short bursts between clean stretches. On about 35% of heartbeats, chosen by a hash of the beat's number (`tearSchedule(beat)`, exported and unit-tested), a tear of 2–4 frames at 24 fps starts at the beat's first peak: slices shift at 0.6 of the switch's strength and one or two tiles jump out, with no afterimage, so about every third beat the figure stutters for a tenth of a second. Each 6.3 s block of seven beats also carries one long tear on its third, fourth, or fifth beat (every 4.5–8.1 s, about 6 s on average): 8 frames, three tiles, slices at 0.8, and one afterimage; when a sheen comes within a second of it, the long tear moves to meet the sheen's burst. Each torn tile gets two 1 px frames in the accent: a faint one (35%) where it was torn from and a firm one (90%) where it landed, so the tear reads as moved from here to there. Every tear is drawn for at least one frame, even on a device that draws fewer than 24 frames a second. Tears wait for the figure to assemble, and never run on light or dark paper, under reduced motion, or while a touch drag is turning the figure.
- **One clock.** The heartbeat runs on `performance.now()` in the hero. When Gear Two turns on, `motion.js` writes `--beat-delay` on the root (minus the clock's position in the 0.9 s cycle), and every CSS pulse (glow, button) starts from that phase, so the page beats as one.
- **Turning it off.** A 300 ms reverse glitch (slices, tiles, afterimages); the tearing stops 140 ms after the palette comes back, and any tear in flight is dropped.
- **Reduced motion.** Everything above collapses to an instant palette switch: no flash, ring, split, slices, tiles, tears, heartbeat, or glow animation.
- **Persistence.** It lasts for the session (`sessionStorage`), so opening a case study keeps it. Turning the lights on exits Gear Two, as it does today. The home page's opening (§7) visits Gear Two without saving it.

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
  - Hero math: projection, ripple, blink schedule, stipple sampler, ring text (whole repeats of the line), the sheen's triggers at the turns of the sway, Gear Two's tear schedule, the relief smoothing that keeps 8-bit depth from terracing the normals, the nearest-pixel material lookup, the opening's timing, the fine grid of the face and hands, each dot's distance to the edge, and the shipped hero data (map sizes, lossless WebP with no color profile, the 200 KB budget).
  - Gear Two, theme, motion preference, filter ↔ URL state, scrollspy.
  - Content integrity on every page: meta and OG tags, one `h1`, alt text, internal links resolve, assets exist, banned-word list, no uppercase paragraphs.
- **Playwright.**
  - All 11 pages × 4 widths × 3 modes: zero console errors, no horizontal overflow, the grid-alignment assertion, and screenshots.
  - Interactions: Gear Two, the theme reveal, filters and URL, keyboard paths, video pause, demo loading, and the reduced-motion paths.
  - The hero through a WebGL probe: one program, one buffer, one VAO per context restoration with identical bytes; a sweep of light within 8 s of load and none under reduced motion; tears after Gear Two's switch and never on light paper, under reduced motion, or during a touch drag; the ring brightening on a theme hover; all five materials in the shipped map; 40% color in Gear Two and plain ink without the map; the opening (still in ink, colours behind its shine, Gear Two and back without saving it), ended by a press or a key, played once a tab and again on a reload, and never under reduced motion.
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
