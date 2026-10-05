// Page generator: stamps the shared chrome (head, header, footer, case-study frame) into every page from
// tools/pages/site.json and tools/pages/projects/*.json, and pastes each case study's hand-written body
// from tools/pages/bodies/<slug>.html. Edit those files, run `node tools/pages/build.mjs`, and commit the
// result; test/pages.test.cjs fails when a committed page and the generator disagree.
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.dirname(new URL(import.meta.url).pathname);
const BODIES = path.join(SRC, 'bodies');
const OUT = process.argv[2] || path.resolve(SRC, '..', '..');
const site = JSON.parse(fs.readFileSync(path.join(SRC, 'site.json'), 'utf8'));
const projects = site.order.map(slug => JSON.parse(fs.readFileSync(path.join(SRC, 'projects', slug + '.json'), 'utf8')));
const themeName = Object.fromEntries(site.themes.map(t => [t.id, t.name]));
const pad = n => String(n).padStart(2, '0');
// Binds the last three words of a run of copy, so no line of it ends the block with one or two words.
const tie = text => text.replace(/ (\S+) (\S+)$/, '&nbsp;$1&nbsp;$2');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, h) => `<a href="${h}">${t}</a>`);
const year = 2026;
const ARROW = '&nbsp;<span class="ext" aria-hidden="true">↗</span>';
const UP = '&nbsp;<span aria-hidden="true">↑</span>';
const OPEN = '&nbsp;<span class="go" aria-hidden="true">→</span>';
// A separator stays at the end of a line when a list wraps.
const DOT = '&nbsp;· ';
const DOWN = '&nbsp;<span aria-hidden="true">↓</span>';
// Selected work alternates wide and narrow plates, mirrored from one band to the next.
const PLATES = [['wide', 'left'], ['narrow', 'right'], ['wide', 'right'], ['narrow', 'left']];
const SEARCH = '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>';
const NEXT = '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg>';

function head({ title, description, url, image, imageAlt, type = 'website', boot = '', extra = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${site.origin}${url}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Aakash Dahal">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${site.origin}${url}">
<meta property="og:image" content="${site.origin}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@${site.x}">
<meta name="twitter:creator" content="@${site.x}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/instrument-sans-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/fragment-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<script>${BOOT}${boot}</script>
<link rel="stylesheet" href="/css/site.css">
${extra}</head>`;
}

const BOOT = `(function(r){try{var t=localStorage.getItem("sky-theme");if(t==="dark"||t==="light")r.setAttribute("data-theme",t);if(sessionStorage.getItem("sky-gear")==="two")r.setAttribute("data-gear","two");if(sessionStorage.getItem("sky-grid")==="on")r.setAttribute("data-grid","on");var m=localStorage.getItem("sky-motion");if(m==="reduced"||(m!=="full"&&matchMedia("(prefers-reduced-motion: reduce)").matches))r.setAttribute("data-motion","reduced")}catch(e){}r.classList.add("js")})(document.documentElement);`;

// The home page preloads the still that covers the figure until it is drawn, for the paper the page opens on (the
// boot script has just set the theme and Gear Two): it is stippled from the ink map on light paper and from the light
// map on dark, like the figure's dots (css/site.css --figure-preview).
const PREVIEW = `(function(r,d){var t=r.getAttribute("data-theme"),dark=r.getAttribute("data-gear")==="two"||t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches),u=dark?"/assets/hero/preview-dark.webp":"/assets/hero/preview.webp",l=d.createElement("link");l.rel="preload";l.as="image";l.fetchPriority="high";l.crossOrigin="anonymous";l.href=u;d.head.appendChild(l)})(document.documentElement,document);`;

const LINES = '<div class="lines" aria-hidden="true"><span></span><span></span><span></span><span></span></div>';

function header(active) {
  const cur = name => (active === name ? ' aria-current="page"' : '');
  return `<a class="skip" href="#main">Skip to content</a>
${LINES}
<div class="fx-flash" aria-hidden="true"></div>
<header class="site-header">
  ${LINES}
  <div class="row">
    <nav class="nav" aria-label="Primary">
      <a class="home" href="/"${cur('home')}>Aakash Dahal</a>
      <a href="/work/"${cur('work')}>Work</a>
      <a class="contact-link" href="/#contact">Contact</a>
    </nav>
    <div class="header-mid">
      <button class="btn gear glitch-text" type="button" aria-pressed="false" data-gear-toggle>Gear Two</button>
      <button class="grid-switch" type="button" aria-pressed="false" aria-keyshortcuts="g" data-grid-toggle>Grid</button>
      <button class="index-open" type="button" aria-label="Open site index" aria-haspopup="dialog" aria-controls="site-index" aria-keyshortcuts="Control+k Meta+k /" data-index-open>${SEARCH}<span>Index</span><kbd aria-hidden="true">/</kbd></button>
    </div>
    <div class="header-end">
      <span class="clock">Kathmandu <b data-time>--:--</b><span class="utc"> · UTC+5:45</span></span>
      <button class="lamp" type="button" aria-pressed="true" aria-label="Lights" data-lamp><span class="lamp-label" aria-hidden="true">Lights</span><span class="lamp-track" aria-hidden="true"><span class="lamp-knob"></span></span></button>
    </div>
  </div>
</header>`;
}

function footer() {
  const source = `https://github.com/${site.github}/${site.github}.github.io`;
  return `<footer class="site-footer">
  <div class="row sign-off rule">
    <p class="sign-name">${site.name}${DOT}<span data-time>--:--</span> UTC+5:45${DOT}${year}</p>
    <p class="sign-links"><a href="${source}">Source${ARROW}</a><a href="${source}/blob/main/docs/design-spec.md">Design spec${ARROW}</a><a href="#main">Back to top${UP}</a></p>
    <div class="sign-toggles">
      <button class="grid-toggle" type="button" aria-pressed="false" aria-label="Construction grid" data-grid-toggle><span aria-hidden="true">Grid</span> <b aria-hidden="true" data-grid-state>Off</b></button>
      <button class="motion-toggle" type="button" aria-pressed="false" aria-label="Reduce motion Off" data-motion-toggle><span aria-hidden="true">Reduce motion</span> <b aria-hidden="true" data-motion-state>Off</b></button>
    </div>
  </div>
</footer>
${siteIndex()}`;
}

function siteIndex() {
  return `<dialog class="site-index" id="site-index" aria-labelledby="index-title" data-lenis-prevent>
  <div class="index-head">
    <div><p class="t-label muted">Navigate</p><h2 id="index-title">Site index</h2></div>
    <button class="index-close" type="button" aria-label="Close site index (Esc)" data-index-close><span class="t-label">Esc</span><span aria-hidden="true">×</span></button>
  </div>
  <label class="index-search" for="index-search">${SEARCH}<input id="index-search" type="search" placeholder="Find a project, page, or technology" aria-label="Search the site index" autocomplete="off" spellcheck="false" enterkeyhint="go" data-index-search></label>
  <div class="index-content" data-lenis-prevent>
    <nav class="index-pages" aria-label="Pages">
      <a href="/" data-index-item data-search="home aakash dahal">Home ${NEXT}</a>
      <a href="/work/" data-index-item data-search="all work projects portfolio">All work ${NEXT}</a>
      <a href="/#contact" data-index-item data-search="contact email github social">Contact ${NEXT}</a>
    </nav>
    <nav aria-label="Projects">
      <p class="index-label t-label muted">Projects</p>
      <ol class="index-projects">
${projects.map((p, i) => `        <li data-index-item data-search="${esc([p.name, p.slug, p.tagline, themesOf(p), ...p.stack].join(' '))}"><a href="/work/${p.slug}/"><span class="t-label muted">${pad(i + 1)}</span><span class="index-project-name">${esc(p.name)}<span class="t-small muted">${themesOf(p, DOT)}</span></span>${NEXT}</a></li>`).join('\n')}
      </ol>
    </nav>
    <p class="index-empty t-small muted" data-index-empty hidden>No matches. Try a project name, a technology, or “contact”.</p>
  </div>
  <div class="index-footer">
    <p class="t-label muted"><kbd>↑</kbd> <kbd>↓</kbd> Browse <span class="index-enter"><kbd>↵</kbd> Open</span></p>
    <button class="index-motion t-label" type="button" aria-label="Motion Full, toggle reduced motion" aria-pressed="false" data-index-motion>Motion <span data-index-motion-state>Full</span></button>
  </div>
  <span class="vh" role="status" aria-live="polite" data-index-status></span>
</dialog>`;
}

function scripts(list) {
  return list.map(s => `<script src="${s}" defer></script>`).join('\n');
}

function themesOf(p, sep = ' · ') { return p.themes.map(t => themeName[t]).join(sep); }

function media(m, { eager = false, cls = '' } = {}) {
  if (!m) return `<div class="media-empty ${cls}"><span class="t-label">Visual placeholder</span></div>`;
  const load = eager ? 'eager' : 'lazy';
  if (m.kind === 'video') {
    return `<video class="${cls}" src="${m.src}" poster="${m.poster}" width="${m.w}" height="${m.h}" muted loop playsinline controls preload="none" aria-label="${esc(m.alt)}" data-autoplay></video>`;
  }
  return `<img class="${cls}" src="${m.src}" alt="${esc(m.alt || '')}" width="${m.w}" height="${m.h}" loading="${load}" decoding="async"${eager ? ' fetchpriority="high"' : ''}>`;
}

function cover(p, sizes, priority = '') {
  if (!p.cover) return `<div class="media-type" aria-hidden="true">${p.stack.slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('')}</div>`;
  const b = p.cover.src;
  return `<img src="${b}-672.webp" srcset="${b}-672.webp 672w, ${b}-1344.webp 1344w" sizes="${sizes}" alt="" width="${p.cover.w}" height="${p.cover.h}" loading="lazy" decoding="async"${priority ? ` fetchpriority="${priority}"` : ''}>`;
}

// Project titles share a view-transition name across pages, so a title morphs into the next page's title.
const vt = p => ` class="vt" style="view-transition-name: t-${p.slug}"`;

/* ── home: the contact dial ───────────────────────── */
// My day on a 24-hour dial, midnight at the foot and noon at the top, so the sun rises on the left and sets
// on the right. The generator draws the face; js/page.js stipples the night in and sets the hands and the readout.
function dial() {
  const at = (t, r) => { const a = t / 24 * 2 * Math.PI; return [+(200 - r * Math.sin(a)).toFixed(2), +(200 + r * Math.cos(a)).toFixed(2)]; };
  const ticks = Array.from({ length: 96 }, (_, k) => {
    const len = k % 24 === 0 ? 14 : k % 4 === 0 ? 8 : 4;
    const [x1, y1] = at(k / 4, 180 - len), [x2, y2] = at(k / 4, 180);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  return `<div class="dial-face">
          <svg viewBox="-24 -24 448 448" aria-hidden="true"><circle class="rim" cx="200" cy="200" r="180"/><g class="ticks">${ticks}</g><g class="night" data-dial-night></g><g class="hands" data-dial-hands></g></svg>
          ${[0, 6, 12, 18].map(h => `<span class="dial-hour h${pad(h)}" aria-hidden="true">${pad(h)}</span>`).join('')}
          <p class="dial-readout" aria-hidden="true"><b data-dial-time></b><span data-dial-place></span><span data-dial-status></span></p>
          <span class="dial-you" aria-hidden="true" data-dial-you hidden></span>
        </div>`;
}

/* ── home ─────────────────────────────────────────── */
function home() {
  const counts = Object.fromEntries(site.themes.map(t => [t.id, projects.filter(p => p.themes.includes(t.id)).length]));
  const featured = site.featured.map(slug => projects.find(p => p.slug === slug));
  const jsonld = { '@context': 'https://schema.org', '@type': 'Person', name: site.name, url: site.origin + '/', email: 'mailto:' + site.email, sameAs: [`https://github.com/${site.github}`, `https://x.com/${site.x}`], description: site.bio };
  return `${head({ title: 'Aakash Dahal', description: site.bio, url: '/', image: '/assets/og/home.png', imageAlt: 'Aakash Dahal: developer tools and interactive physics software', boot: PREVIEW, extra: `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` })}
<body class="page-home">
${header('home')}
<main id="main">
  <section class="hero" aria-labelledby="hero-name">
    <div class="row">
      <div class="intro">
        <p class="intro-label t-label muted">Developer</p>
        <h1 id="hero-name">Aakash Dahal</h1>
        <p>${tie(esc(site.intro))}</p>
        <div class="intro-actions"><a class="action-link" href="#selected">See the evidence <span aria-hidden="true">↓</span></a><a class="link-ui" href="https://github.com/${site.github}">GitHub${ARROW}</a></div>
      </div>
      <div class="hero-figure" id="figure" role="img" aria-label="My GitHub avatar, a winged statue raising a caduceus, drawn as a turning sculpture of dots inside a ring that reads: ${esc(site.ringLine)}." data-ring="${esc(site.ringLine)}">
        <div class="still" aria-hidden="true"></div>
      </div>
      <aside class="essentially panel" aria-labelledby="why-title">
        <h2 class="panel-head" id="why-title">${esc(site.why.title)}</h2>
        <p class="panel-body">${tie(esc(site.why.body))}</p>
      </aside>
      <nav class="themes" aria-labelledby="themes-title">
        <h2 class="t-label muted" id="themes-title">Work by theme</h2>
        <ol>
${site.themes.map((t, i) => `          <li><a href="/work/?theme=${t.id}" data-theme-link="${t.id}"><span class="t-label muted">${pad(i + 1)}</span><span class="t-small">${t.name}</span><span class="t-label muted num">${pad(counts[t.id])}</span></a></li>`).join('\n')}
        </ol>
      </nav>
      <div class="fig-note"><p class="t-label muted">Fig. 0${DOT}Interactive sculpture</p><p class="t-small">My GitHub avatar as <span data-dot-count>${site.dots}</span> dots in five materials, lifted into 3D with a monocular depth map. <span class="fine">Move the cursor to stir them; click to call down lightning.</span><span class="coarse">Tap for lightning; drag sideways to turn.</span></p><p class="fig-telemetry t-label muted num" data-hero-telemetry aria-hidden="true" hidden></p><button class="figure-ripple link-ui" type="button" data-hero-ripple hidden>Call down lightning</button></div>
    </div>
  </section>

  <section class="section" id="selected" aria-labelledby="selected-title">
    <div class="row section-head rule" data-reveal>
      <h2 class="c1" id="selected-title">Selected work</h2>
      <a class="end link-ui" href="/work/">All work${DOT}${pad(projects.length)}${OPEN}</a>
    </div>
    <div class="row plates">
${featured.map((p, i) => { const [size, side] = PLATES[i % PLATES.length]; return `      <article class="plate plate-${size} plate-${side}" data-project="${p.slug}">
        <div class="plate-media">${cover(p, size === 'wide' ? '(max-width: 1199px) 100vw, 75vw' : '(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 25vw', 'low')}</div>
        <div class="plate-caption">
          <p class="plate-line">Plate ${pad(i + 1)}${DOT}${themesOf(p, DOT)}${DOT}${p.visibility}</p>
          <h3><a href="/work/${p.slug}/"${vt(p)}>${esc(p.name)}</a>${OPEN}</h3>
          <p>${tie(esc(p.tagline))}</p>
        </div>
      </article>`; }).join('\n')}
    </div>
  </section>

  <section class="section" id="contact" aria-labelledby="contact-title">
    <div class="row band rule contact" data-reveal>
      <h2 class="band-title" id="contact-title">Contact</h2>
      <p class="band-note" data-contact-note>My clock reads&nbsp;<span data-time>--:--</span>&nbsp;(UTC+5:45). Email reaches me&nbsp;fastest.</p>
      <ul class="hang-list contact-lines">
        <li><span>Email</span><span><a href="mailto:${site.email}">${site.email}</a> <button class="copy" type="button" data-copy="${site.email}">Copy</button></span></li>
        <li><span>X</span><span><a href="https://x.com/${site.x}">@${site.x}${ARROW}</a></span></li>
        <li><span>GitHub</span><span><a href="https://github.com/${site.github}">${site.github}${ARROW}</a></span></li>
      </ul>
      <figure class="dial" data-dial>
        ${dial()}
        <figcaption><span class="t-label muted">Fig. 1</span><span class="t-small">${tie('My day on a 24-hour dial, noon at the top and the night stippled in. Point at any hour to see what I’m probably doing then.')}</span></figcaption>
      </figure>
    </div>
  </section>
</main>
${footer()}
<span class="vh" aria-live="polite" data-announce></span>
${scripts(['/js/theme.js', '/assets/vendor/lenis.min.js', '/js/motion.js', '/js/hero.js', '/js/page.js'])}
</body>
</html>
`;
}

/* ── work index ───────────────────────────────────── */
function work() {
  const counts = Object.fromEntries(site.themes.map(t => [t.id, projects.filter(p => p.themes.includes(t.id)).length]));
  const filterBoot = `(function(r){var m=/[?&]theme=(${site.themes.map(t => t.id).join('|')})(&|$)/.exec(location.search);if(m)r.setAttribute("data-filter",m[1]);try{if(localStorage.getItem("sky-work-view")==="grid")r.setAttribute("data-work-view","grid")}catch(e){}})(document.documentElement);`;
  return `${head({ title: 'Work — Aakash Dahal', description: 'Eight projects by Aakash Dahal across AI systems, developer tools, and physics software, each with a case study.', url: '/work/', image: '/assets/og/work.png', imageAlt: 'Work by Aakash Dahal: eight projects', boot: filterBoot })}
<body class="page-work">
${header('work')}
<main id="main">
  <div class="row page-head">
    <h1>Work</h1>
    <p class="count"><span data-count>${pad(projects.length)}</span> of ${pad(projects.length)} projects</p>
    <div class="filters" role="group" aria-label="Filter by theme" data-filters>
      <button class="filter" type="button" aria-pressed="true" data-filter="all">All <span class="k num">${pad(projects.length)}</span></button>
${site.themes.map(t => `      <button class="filter" type="button" aria-pressed="false" data-filter="${t.id}">${t.name} <span class="k num">${pad(counts[t.id])}</span></button>`).join('\n')}
    </div>
  </div>
  <div class="row work-toolbar">
    <div class="work-find"><div class="work-search"><input type="search" aria-label="Search projects" placeholder="Search projects, stacks, or themes" autocomplete="off" spellcheck="false" data-work-search><button type="button" aria-label="Clear project search" data-clear-search hidden>Clear</button></div></div>
    <div class="work-views" role="group" aria-label="Work layout">
      <button type="button" aria-label="List view" aria-pressed="true" data-work-view="list">List</button>
      <button type="button" aria-label="Grid view" aria-pressed="false" data-work-view="grid">Grid</button>
    </div>
  </div>
  <ol class="projects" aria-label="Projects">
${projects.map((p, i) => `    <li class="project" data-themes="${p.themes.join(' ')}" data-project="${p.slug}" data-search="${esc([p.name, p.slug, p.tagline, themesOf(p), p.visibility, ...p.stack].join(' '))}">
      <span class="idx" aria-hidden="true">${pad(i + 1)}</span>
      <div class="project-title"><h2><a href="/work/${p.slug}/"${vt(p)}>${esc(p.name)}</a>${OPEN}</h2><p>${tie(esc(p.tagline))}</p></div>
      <p class="facts"><span class="themes-line">${themesOf(p, DOT)}</span><span>${p.stack.slice(0, 3).map(esc).join(DOT)}</span><span>${p.visibility}</span></p>
      <div class="thumb" aria-hidden="true">${cover(p, '(max-width: 767px) 50vw, 25vw')}</div>
    </li>`).join('\n')}
  </ol>
  <div class="row work-empty" data-work-empty hidden><div class="work-empty-note"><h2>No matching projects</h2><p>Try another name, technology, or theme.</p><button class="reset" type="button" data-clear-work>Reset filters</button></div></div>
</main>
${footer()}
<span class="vh" aria-live="polite" data-announce></span>
${scripts(['/js/theme.js', '/assets/vendor/lenis.min.js', '/js/motion.js', '/js/page.js'])}
</body>
</html>
`;
}

/* ── case study ───────────────────────────────────── */
const SECTIONS = [
  ['problem', 'The problem', 'The concrete failure or gap this project addresses, in engineering terms: who runs into it, what goes wrong, and why existing tools miss it. 80–140 words.'],
  ['built', 'What I built', 'What exists today: the main pieces and what someone actually does with them. 100–180 words.'],
  ['how', 'How it works', 'The pipeline or mechanism, using the real module names, data structures, algorithms, and thresholds from the code. 120–220 words, plus the diagram below.'],
  ['decisions', 'Key decisions', 'Three or four decisions. For each: the decision in one sentence, why it was made, and what it cost. 40–70 words each.'],
  ['hard', 'What’s hard', 'Two or three genuinely difficult problems in this codebase (correctness, concurrency, numerics, security, UX under uncertainty) and how the code handles them. 40–80 words each.'],
  ['status', 'Status and next', 'What works now, its honest limits, and two or three next steps that follow from documented limitations. 60–120 words.'],
];

function placeholder(text) {
  return `<p class="placeholder" data-placeholder><span class="ph-tag t-label">To write</span><span class="ph-text t-small">${tie(esc(text))}</span></p>`;
}

function diagramPlaceholder() {
  const spec = { direction: 'LR', nodes: [ { id: 'in', label: 'Input', sub: 'what comes in' }, { id: 'core', label: 'Core mechanism', sub: 'what the code does' }, { id: 'out', label: 'Result', sub: 'what comes out' } ], edges: [ { from: 'in', to: 'core' }, { from: 'core', to: 'out' } ] };
  return `<figure class="diagram wide" data-diagram data-placeholder>
            <script type="application/json">${JSON.stringify(spec)}</script>
            <ol class="diagram-steps t-small">${spec.nodes.map(n => `<li>${esc(n.label)}: ${esc(n.sub)}</li>`).join('')}</ol>
            <figcaption><span class="t-label muted">Fig. 2</span><span class="t-small">${tie('Placeholder diagram: 3–7 nodes in one direction, readable in ten seconds.')}</span></figcaption>
          </figure>`;
}

// A body file holds the case study's prose sections, then a `<!-- numbers -->` line, then the numbers <dl>.
// Both parts are pasted verbatim; the section index is read from the sections' ids and headings.
function bodyOf(slug) {
  const file = path.join(BODIES, slug + '.html');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8').replace(/^<!--[\s\S]*?-->\n/, '');
  const parts = text.split(/^<!-- numbers -->\n/m);
  if (parts.length !== 2) throw new Error(`${file}: expected exactly one "<!-- numbers -->" line`);
  const sections = [...parts[0].matchAll(/<section id="([a-z-]+)" aria-labelledby="\1-title">\s*<h2 id="\1-title">([^<]+)<\/h2>/g)].map(m => [m[1], m[2]]);
  return { prose: parts[0].replace(/\s+$/, ''), numbers: parts[1].replace(/\s+$/, ''), sections };
}

function caseStudy(p, i) {
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const url = `/work/${p.slug}/`;
  const body = bodyOf(p.slug);
  const toc = body ? body.sections : SECTIONS;
  const repoRow = p.repo
    ? `<dt class="t-label">Code</dt><dd><a href="${p.repo}">github.com/${site.github}/${p.slug}</a>${ARROW}</dd>`
    : `<dt class="t-label">Code</dt><dd>Private repository</dd>`;
  const lead = p.lead;
  const leadFig = `<figure class="fig c2-4">
        <div class="fig-frame${lead ? '' : ' is-empty'}" data-reveal>${lead ? media(lead, { eager: true }) : '<div class="media-empty"><span class="t-label">Visual to come</span></div>'}</div>
        <figcaption><span class="t-label muted">Fig. 1</span><span class="t-small">${tie(lead ? esc(lead.caption) : 'To come: a screenshot, recording, or demo of the real product.')}</span></figcaption>
      </figure>`;
  const preload = lead && lead.kind === 'video' ? `<link rel="preload" href="${lead.poster}" as="image" fetchpriority="high">\n` : '';
  return `${head({ title: `${p.name} — Aakash Dahal`, description: p.summary, url, image: `/assets/og/${p.slug}.png`, imageAlt: `${p.name}: ${p.tagline}`, type: 'article', extra: preload })}
<body class="page-case" data-project="${p.slug}">
${header('work')}
<main id="main">
  <div class="row case-head">
    <p class="crumb"><a href="/work/">Work</a>${DOT}${pad(i + 1)}</p>
    <div class="case-title">
      <h1${vt(p)}>${esc(p.name)}</h1>
      <p>${esc(p.summary)}</p>
      <p class="case-actions"><a href="#problem">Read case study${DOWN}</a>${p.repo ? `<a href="${p.repo}">View source${ARROW}</a>` : ''}</p>
    </div>
    <div class="meta">
      <dl>
        <dt class="t-label">Role</dt><dd>Designed and built solo</dd>
        <dt class="t-label">Status</dt><dd>${esc(p.status)}</dd>
        <dt class="t-label">Themes</dt><dd>${themesOf(p)}</dd>
        <dt class="t-label">Stack</dt><dd>${p.stack.map(esc).join(DOT)}</dd>
        ${repoRow}
      </dl>
    </div>
  </div>

  <div class="row lead-media">
    ${leadFig}
  </div>

  <div class="row case-body">
    <nav class="toc" aria-label="On this page">
      <div class="toc-head"><span class="t-label muted">On this page</span><span class="t-label muted" data-reading-progress aria-hidden="true">00%</span></div>
      <div class="reading-track" aria-hidden="true"><span data-reading-bar></span></div>
      <ol data-lenis-prevent>
${toc.map(([id, title]) => `        <li><a href="#${id}">${title}</a></li>`).join('\n')}
        <li><a href="#stack">Stack and links</a></li>
      </ol>
    </nav>
    <article class="prose">
${body ? body.prose : SECTIONS.map(([id, title, guide]) => `      <section id="${id}" aria-labelledby="${id}-title">
        <h2 id="${id}-title">${title}</h2>
        ${placeholder(guide)}${id === 'how' ? '\n          ' + diagramPlaceholder() : ''}
      </section>`).join('\n')}
      <section id="stack" aria-labelledby="stack-title">
        <h2 id="stack-title">Stack and links</h2>
        <ul class="stack-list">${p.stack.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <p class="links">${p.repo ? `<a href="${p.repo}">Source on GitHub</a>${ARROW}` : 'The repository is private.'}</p>
      </section>
    </article>
    <aside class="aside" aria-label="Key numbers">
      <div class="numbers">${body ? `\n${body.numbers}\n      ` : placeholder('Four to six verified facts from the code: counts, limits, sizes, test results.')}</div>
    </aside>
  </div>

  <nav class="row pager" aria-label="More projects">
    <ul class="hang-list">
      <li><span>Previous</span><a href="/work/${prev.slug}/">${esc(prev.name)}${OPEN}</a></li>
      <li><span>Next</span><a href="/work/${next.slug}/">${esc(next.name)}${OPEN}</a></li>
    </ul>
  </nav>
</main>
${footer()}
<span class="vh" aria-live="polite" data-announce></span>
${scripts(['/js/theme.js', '/assets/vendor/lenis.min.js', '/js/motion.js', '/js/diagram.js', ...(body && body.prose.includes('data-demo') ? ['/js/demo.js'] : []), '/js/page.js'])}
</body>
</html>
`;
}

function notFound() {
  return `${head({ title: 'Not found — Aakash Dahal', description: 'There is no page at this address. The portfolio now lives at /work.', url: '/404.html', image: '/assets/og/home.png', imageAlt: 'Aakash Dahal' }).replace(/<link rel="canonical"[^>]*>/, '<meta name="robots" content="noindex">')}
<body class="page-404">
${header('')}
<main id="main">
  <div class="row lost">
    <div class="c1-2">
      <h1 class="t-l">Nothing at this address</h1>
      <p>The page may have moved when the portfolio became /work.</p>
      <p class="links t-ui"><a class="link-ui" href="/">Home</a><a class="link-ui" href="/work/">Work</a></p>
    </div>
  </div>
</main>
${footer()}
${scripts(['/js/theme.js', '/js/motion.js', '/js/page.js'])}
</body>
</html>
`;
}

function redirect(to) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved to ${to}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${site.origin}${to}">
<meta http-equiv="refresh" content="0; url=${to}">
</head>
<body>
<p><a href="${to}">This page moved to ${to}</a></p>
</body>
</html>
`;
}

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

write('index.html', home());
write('work/index.html', work());
projects.forEach((p, i) => write(`work/${p.slug}/index.html`, caseStudy(p, i)));
write('404.html', notFound());
write('portfolio/index.html', redirect('/work/'));
const urls = ['/', '/work/', ...projects.map(p => `/work/${p.slug}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${site.origin}${u}</loc></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *
Disallow: /docs/
Disallow: /research/
Disallow: /test/
Disallow: /tools/

Sitemap: ${site.origin}/sitemap.xml
`);
console.log('wrote', 4 + projects.length, 'pages, sitemap.xml, and robots.txt');
