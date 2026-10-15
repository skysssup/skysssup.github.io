// The compact studio uses the existing project records and original artwork.
const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad = value => String(value).padStart(2, '0');
const search = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>';
const lamp = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5.5"/><path class="theme-half" d="M10 4.5a5.5 5.5 0 0 1 0 11Z"/></svg>';
const envelope = '<svg viewBox="0 0 64 44" aria-hidden="true"><path d="M3 5h58v34H3ZM3 5l29 22L61 5M3 39l20-19M61 39 41 20"/></svg>';
function thumb(svg) {
  return svg.replace(/<title[^>]*>[\s\S]*?<\/title>/g, '').replace(/\saria-labelledby="[^"]*"/g, '').replace(/role="img"/g, 'aria-hidden="true"');
}
function evidence(p) {
  if (!p.lead) return '';
  const m = p.lead;
  const media = m.kind === 'video'
    ? `<video data-studio-video src="${esc(m.src)}" poster="${esc(m.poster)}" width="${m.w}" height="${m.h}" muted loop playsinline controls preload="none" aria-label="${esc(m.alt)}"></video>`
    : `<img src="${esc(m.src)}" width="${m.w}" height="${m.h}" alt="${esc(m.alt)}" loading="lazy" decoding="async">`;
  return `<div class="studio-evidence studio-art-frame" data-studio-evidence>${media}<button type="button" class="studio-evidence-zoom" data-studio-evidence-zoom="${p.slug}" aria-label="View ${esc(p.name)} evidence large">view large ↗</button></div>`;
}
function avatarControls() {
  return `<div class="studio-avatar-controls" role="group" aria-label="Avatar appearance"><span>portrait</span><button type="button" aria-label="Red avatar" aria-pressed="false" data-gear-toggle><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 3v18M3 12h18m-15-6 12 12M6 18 18 6"/></svg><span>red</span></button><button type="button" aria-label="Blue avatar" aria-pressed="false" data-gear-blue><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M4 12c0-7 13-9 14-3 1 5-10 8-10 3 0-3 6-4 7-1"/></svg><span>blue</span></button></div>`;
}
export function studioBody({site, projects, scenes, labControls, headerMark, siteIndex, scripts}) {
  const entries = [{slug:'about',name:'about',status:'profile',art:headerMark}, ...projects.map(p=>({...p,art:p.lead?`<img src="${esc(p.lead.poster||p.lead.src)}" width="${p.lead.w}" height="${p.lead.h}" alt="" loading="lazy" decoding="async">`:thumb(scenes[p.slug].svg)})),{slug:'contact',name:'contact',status:'email',art:envelope}];
  return `<body class="page-home studio-page">
<div class="fx-flash" aria-hidden="true"></div>
<div class="studio-shell" data-studio>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header studio-header"><div class="row">
    <a class="studio-brand" href="#about" data-studio-route="about" aria-label="Aakash Dahal — about">${headerMark}<span>${esc(site.name)}</span></a>
    <nav class="studio-header-links" aria-label="Primary"><a href="https://github.com/${esc(site.github)}">github</a><button type="button" class="tool-button theme-switch" aria-label="Light theme" aria-pressed="false" data-lamp>${lamp}</button><button type="button" class="tool-button index-open" aria-label="Open site index" aria-haspopup="dialog" aria-expanded="false" aria-controls="site-index" data-index-open>${search}</button></nav>
  </div></header>
  <main id="main" class="studio-editor" tabindex="-1" aria-label="Projects and profile">
    <h1 class="vh">${esc(site.name)}</h1>
    <button type="button" class="studio-picker" aria-expanded="false" aria-controls="studio-projects" data-studio-picker><span>~/work/<b data-studio-picker-name>about</b></span><span aria-hidden="true">↓</span></button>
    <nav class="studio-wheel" id="studio-projects" aria-label="Select a project" data-studio-wheel>
      <canvas class="studio-spine" aria-hidden="true"></canvas>
      <div class="studio-wheel-window"><ul role="listbox" aria-label="Projects and profile">
${entries.map((p,i)=>`        <li role="none" data-studio-item><button id="studio-pick-${p.slug}" type="button" role="option" class="studio-tile${i===0?' is-active':''}" data-studio-pick="${i}" aria-selected="${i===0}" aria-controls="${p.slug==='about'?'about':p.slug==='contact'?'contact':'project-'+p.slug}" tabindex="${i===0?0:-1}"><span class="studio-thumbnail" aria-hidden="true">${p.art}</span><span class="studio-tile-name">${esc(p.name)}</span></button></li>`).join('\n')}
      </ul></div>
      <div class="studio-wheel-hint">scroll · drag the wheel</div>
    </nav>
    <div class="studio-pane" tabindex="-1" aria-label="Selected project details">
      <article class="studio-panel is-current" id="about" data-studio-panel="about" tabindex="-1">
        <div class="studio-content"><div class="studio-path">profile — ${esc(site.name)}</div>
          <section class="hero studio-art-frame" id="hero" aria-label="Original avatar"><div class="hero-figure" id="figure" role="img" aria-label="Hermes, my GitHub avatar, rendered in gold and marble particles."><div class="still" aria-hidden="true"></div></div><button type="button" class="studio-zoom" data-studio-zoom="about" aria-label="View avatar large">⛶</button></section>
          <div class="studio-copy"><h2>${esc(site.name)}</h2><p>${esc(site.bio)}</p>
            <dl class="studio-facts"><dt>work</dt><dd>${site.themes.map(t=>esc(t.name)).join(' · ')}</dd><dt>projects</dt><dd>${projects.length} <a href="/work/">browse all ↗</a></dd><dt>source</dt><dd><a href="https://github.com/${esc(site.github)}">github.com/${esc(site.github)}</a></dd><dt>contact</dt><dd><a href="#contact" data-studio-route="contact">email ↗</a></dd></dl>
            ${avatarControls()}
          </div>
        </div>
      </article>
${projects.map((p,i)=>{const s=scenes[p.slug];return `      <article class="studio-panel work-card" id="project-${p.slug}" data-studio-panel="${p.slug}" data-scene="${p.slug}" data-studio-view="${p.lead?'evidence':'illustration'}" tabindex="-1">
        <div class="studio-content"><div class="studio-path">work / ${esc(p.slug)}</div>
          <div class="studio-copy scene-copy"><h2 class="work-card-name"${i===0?' id="work-list"':''}>${esc(p.name)}</h2><p class="work-card-desc">${esc(p.summary||p.tagline)}</p><dl class="studio-facts"><dt>status</dt><dd class="studio-project-status" data-status="${esc(p.status)}">${esc(p.status)}</dd><dt>source</dt><dd>${esc(p.visibility)}</dd><dt>stack</dt><dd>${p.stack.map(esc).join(' · ')}</dd></dl>
          <nav class="scene-links" aria-label="${esc(p.name)} links"><a href="/work/${p.slug}/">${p.placeholder?'project notes':'case study'} ↗</a>${p.repo?`<a href="${esc(p.repo)}">source ↗</a>`:''}</nav></div>
          <div class="scene-heading"><span data-studio-view-label>${p.lead?(p.lead.kind==='video'?'Recording':'Screenshot'):esc(s.label)}</span><span>${pad(i+1)} / ${pad(projects.length)}</span></div>
          ${evidence(p)}
          <div class="scene-drawing studio-art-frame" data-studio-zoom="${p.slug}">${s.svg}</div>
          <div class="scene-toolbar studio-illustration-toolbar"><span class="scene-caption">Illustration · <span data-scene-status>${esc(s.idle)}</span></span><button type="button" class="scene-action" data-scene-action aria-pressed="false">Replay <span aria-hidden="true">↻</span></button></div>

          ${p.lead?`<div class="studio-gallery-controls" role="group" aria-label="${esc(p.name)} views"><button type="button" data-studio-view-pick="evidence" aria-pressed="true" aria-label="Show ${esc(p.name)} evidence">1</button><button type="button" data-studio-view-pick="illustration" aria-pressed="false" aria-label="Show ${esc(p.name)} illustration">2</button><span data-studio-gallery-caption>${esc(p.lead.caption)}</span></div>`:''}
          <details class="studio-model"><summary>Try illustration</summary>${labControls(p.slug)}</details>
        </div>
      </article>`;}).join('\n')}
      <article class="studio-panel" id="contact" data-studio-panel="contact" tabindex="-1"><div class="studio-content"><div class="studio-path">contact /</div><div class="studio-copy studio-contact"><h2>Contact</h2><p data-contact-note>Email reaches me fastest.</p><div class="studio-mail"><a href="mailto:${esc(site.email)}" data-email-text>${esc(site.email)}</a><button type="button" class="copy" aria-label="Copy email address" data-copy="${esc(site.email)}"><span data-copy-label>Copy</span></button></div><nav aria-label="Elsewhere"><a href="https://github.com/${esc(site.github)}">github ↗</a><a href="https://x.com/${esc(site.x)}">x ↗</a></nav></div></div></article>
    </div>
  </main>
  <footer class="studio-status">
    <div class="studio-status-identity"><span>${esc(site.name)}</span><small>↑↓ project · ↵ details</small></div>
    <div class="studio-status-field"><span>projects</span><b>${pad(projects.length)}</b></div>
    <div class="studio-status-field studio-status-project"><span data-studio-current-name>about</span><b data-studio-status>profile</b></div>
    <button type="button" class="motion-toggle studio-status-field" aria-label="Reduce motion Off" aria-pressed="false" data-motion-toggle><span aria-hidden="true">reduce motion</span><b aria-hidden="true" data-motion-state>Off</b></button>
    <button type="button" class="studio-status-field studio-live" data-bench-live aria-pressed="true"><span>examples</span><b data-studio-live-label>on</b></button>
    <nav class="studio-status-nav" aria-label="Project navigation"><button type="button" data-studio-step="-1" aria-label="Previous item">↑</button><output aria-label="Selected item" data-studio-count>01 / ${pad(entries.length)}</output><button type="button" data-studio-step="1" aria-label="Next item">↓</button></nav>
  </footer>
</div>
${siteIndex()}
<dialog class="studio-viewer" id="studio-viewer" aria-labelledby="studio-viewer-title"><div class="studio-viewer-head"><h2 id="studio-viewer-title">Artwork</h2><button type="button" data-studio-viewer-close aria-label="Close artwork viewer">close ×</button></div><div class="studio-viewer-stage"></div></dialog>
<span class="vh" aria-live="polite" data-announce></span>
<script type="application/json" id="studio-data">${JSON.stringify(entries.map(p=>({slug:p.slug,name:p.name,status:p.status,evidence:p.lead?{label:p.lead.kind==='video'?'Recording':'Screenshot',caption:p.lead.caption}:null,scene:scenes[p.slug]?{idle:scenes[p.slug].idle,steps:scenes[p.slug].steps,points:scenes[p.slug].points,inspect:scenes[p.slug].inspect}:null}))).replace(/</g,'\\u003c')}</script>
${scripts(['/js/theme.js','/js/motion.js','/js/hero.js','/js/page.js','/js/lab-controls.js','/js/studio-wheel.js','/js/studio-scenes.js','/js/studio.js'])}
</body>
</html>`.replace(/[ \t]+\n/g, '\n');
}
