// Home studio: persistent centered portrait, then a plain project list and evidence.
import { projectLab } from './project-lab.mjs';

const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad = value => String(value).padStart(2, '0');
const search = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>';
const lamp = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5.5"/><path class="theme-half" d="M10 4.5a5.5 5.5 0 0 1 0 11Z"/></svg>';

function evidence(p) {
  if (!p.lead) {
    const note = p.sourceNote || 'No public screenshot is published for this project.';
    return `<div class="studio-evidence studio-evidence-empty" data-studio-evidence><p>${esc(note)}</p></div>`;
  }
  const m = p.lead;
  const media = m.kind === 'video'
    ? `<video data-studio-video src="${esc(m.src)}" poster="${esc(m.poster || '')}" width="${m.w}" height="${m.h}" muted loop playsinline controls preload="none" aria-label="${esc(m.alt)}"></video>`
    : `<img src="${esc(m.src)}" width="${m.w}" height="${m.h}" alt="${esc(m.alt)}" loading="lazy" decoding="async">`;
  return `<figure class="studio-evidence" data-studio-evidence>${media}<figcaption>${esc(m.caption)}</figcaption><button type="button" class="studio-evidence-zoom" data-studio-evidence-zoom="${esc(p.slug)}" aria-label="View ${esc(p.name)} evidence large">view large</button></figure>`;
}

function avatarControls() {
  return `<div class="studio-avatar-controls" role="group" aria-label="Avatar appearance"><button type="button" aria-label="Gold avatar" aria-pressed="true" data-gear-neutral><i aria-hidden="true"></i><span>gold</span></button><button type="button" aria-label="Red avatar" aria-pressed="false" data-gear-toggle><i aria-hidden="true"></i><span>red</span></button><button type="button" aria-label="Blue avatar" aria-pressed="false" data-gear-blue><i aria-hidden="true"></i><span>blue</span></button></div>`;
}

export function studioBody({site, projects, scenes, labControls, headerMark, siteIndex, scripts}) {
  void scenes;
  void labControls;
  const entries = [
    {slug:'about', name:site.name, status:'profile', kind:'profile'},
    ...projects.map(p => ({slug:p.slug, name:p.name, status:p.status, kind:'project', evidence:p.lead?{label:p.lead.kind==='video'?'Recording':'Screenshot', caption:p.lead.caption}:null})),
    {slug:'contact', name:'Contact', status:'email', kind:'contact'}
  ];
  return `<body class="page-home studio-page">
<div class="fx-flash" aria-hidden="true"></div>
<div class="studio-shell" data-studio>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header studio-header"><div class="row">
    <a class="studio-brand" href="#about" aria-label="${esc(site.name)}, portrait">${headerMark}<span>${esc(site.name)}</span></a>
    <nav class="studio-header-links" aria-label="Primary"><a href="#work-list">Work</a><a href="#contact">Contact</a><a href="https://github.com/${esc(site.github)}">GitHub</a><button type="button" class="tool-button theme-switch" aria-label="Light theme" aria-pressed="false" data-lamp>${lamp}</button><button type="button" class="tool-button index-open" aria-label="Open site index" aria-haspopup="dialog" aria-expanded="false" aria-controls="site-index" data-index-open>${search}</button></nav>
  </div></header>
  <main id="main">
    <section class="hero studio-stage" id="hero" aria-labelledby="hero-name">
      <span id="about" aria-hidden="true" style="position:absolute;top:0"></span>
      <div class="hero-figure" id="figure" role="img" aria-label="Hermes, my GitHub avatar, rendered in gold and marble particles."><div class="still" aria-hidden="true"></div></div>
      <div class="studio-identity" data-studio-panel="about">
        <h1 id="hero-name">${esc(site.name)}</h1>
        <p>${esc(site.bio)}</p>
        ${avatarControls()}
        <button type="button" class="studio-zoom" data-studio-zoom="about" aria-label="View avatar large">view large</button>
        <a class="studio-next" href="#work-list">Work</a>
      </div>
    </section>
    <section class="studio-work" id="work-list" aria-labelledby="work-title">
      <div class="studio-work-head"><h2 id="work-title">Work</h2><p>${projects.length} projects. Hover previews. Click keeps a selection. <a href="/work/">All notes</a></p></div>
      <div class="studio-work-layout">
        <div class="studio-list-wrap">
          <span class="studio-marker" data-studio-marker aria-hidden="true"></span>
          <ul class="studio-list" id="studio-projects" role="listbox" aria-label="Projects" aria-activedescendant="${esc(projects[0].slug)}">
${projects.map((p,i)=>`            <li role="none"><a id="${esc(p.slug)}" class="studio-row${i===0?' is-selected':''}" href="#project-${esc(p.slug)}" role="option" data-studio-pick="${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${pad(i+1)}<span>${esc(p.name)}</span><small>${esc(p.status)}</small></a></li>`).join('\n')}
          </ul>
        </div>
        <div class="studio-detail" data-studio-detail aria-live="off">
          <p class="studio-list-jump"><a href="#studio-projects">Project list</a></p>
${projects.map(p=>`          <article class="studio-panel work-card" id="project-${esc(p.slug)}" data-studio-panel="${esc(p.slug)}" data-scene="${esc(p.slug)}" data-studio-view="evidence" tabindex="-1">
            ${evidence(p)}
            <div class="studio-copy">
              <h3 class="work-card-name">${esc(p.name)}</h3>
              <p class="work-card-desc">${esc(p.summary||p.tagline)}</p>
              <dl class="studio-facts"><dt>status</dt><dd class="studio-project-status" data-status="${esc(p.status)}">${esc(p.status)}</dd><dt>source</dt><dd>${esc(p.visibility)}</dd><dt>stack</dt><dd>${p.stack.map(esc).join(' · ')}</dd></dl>
              <nav class="scene-links" aria-label="${esc(p.name)} links"><a href="/work/${esc(p.slug)}/">${p.placeholder?'Project notes':'Case study'}</a>${p.repo?`<a href="${esc(p.repo)}">Source</a>`:''}${p.slug==='airforge'?'<a href="https://skysssup.github.io/airforge/?example=ramp-and-ball" data-playground-open>Draw &amp; simulate ↗</a>':''}</nav>
              <details class="studio-lab"><summary>Live lab <span>local demo</span></summary>${projectLab(p)}</details>
            </div>
          </article>`).join('\n')}
        </div>
      </div>
    </section>
    <section class="studio-contact" id="contact" data-studio-panel="contact" aria-labelledby="contact-title">
      <h2 id="contact-title">Contact</h2>
      <p data-contact-note>Email reaches me fastest.</p>
      <div class="studio-mail"><a href="mailto:${esc(site.email)}" data-email-text>${esc(site.email)}</a><button type="button" class="copy" aria-label="Copy email address" data-copy="${esc(site.email)}"><span data-copy-label>Copy</span></button></div>
      <nav aria-label="Elsewhere"><a href="https://github.com/${esc(site.github)}">GitHub</a><a href="https://x.com/${esc(site.x)}">X</a></nav>
    </section>
  </main>
  <footer class="studio-status">
    <span>${esc(site.name)}</span>
    <button type="button" class="motion-toggle" aria-label="Reduce motion Off" aria-pressed="false" data-motion-toggle><span aria-hidden="true">Reduce motion</span> <b aria-hidden="true" data-motion-state>Off</b></button>
    <button type="button" data-bench-live aria-pressed="true"><span>Examples</span> <b data-studio-live-label>on</b></button>
  </footer>
</div>
${siteIndex()}
<dialog class="studio-viewer" id="studio-viewer" aria-labelledby="studio-viewer-title"><div class="studio-viewer-head"><h2 id="studio-viewer-title">Evidence</h2><button type="button" data-studio-viewer-close aria-label="Close viewer">close</button></div><div class="studio-viewer-stage"></div></dialog>
<span class="vh" aria-live="polite" data-announce></span>
<script type="application/json" id="studio-data">${JSON.stringify(entries).replace(/</g,'\\u003c')}</script>
${scripts(['/js/theme.js','/js/motion.js','/js/hero.js','/js/page.js','/js/project-lab.js','/js/studio.js','/js/project-playground.js'])}
</body>
</html>`;
}
