// Static local-example panels. The other layout worker inserts this HTML.
// Behavior lives in js/project-lab.js. Nothing here calls a network or a product API.

const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

function shell(project, label, limitation, body) {
  const slug = String(project.slug || 'unknown');
  const name = String(project.name || slug);
  return `<section class="project-lab" data-project-lab="${esc(slug)}" aria-label="${esc(name + '. ' + label)}">
<p class="project-lab__banner"><strong>Local example.</strong> ${esc(limitation)}</p>
${body}
</section>`;
}

function agent(project) {
  return shell(project, 'AgentCrucible local illustrative check', 'Counts and wording only. Not an AgentCrucible grade.', `
<form class="project-lab__form" data-lab-form="agentcrucible">
<div class="project-lab__field"><label for="pl-agentcrucible-fault">Fault preset</label>
<select id="pl-agentcrucible-fault" data-field="fault">
<option value="timeout_after_commit" selected>Timeout after commit</option>
<option value="omission">Omission (nothing committed)</option>
<option value="none">No fault</option>
</select></div>
<div class="project-lab__field"><label for="pl-agentcrucible-committed">Committed mutations</label>
<input id="pl-agentcrucible-committed" data-field="committed" type="number" inputmode="numeric" min="0" max="9" step="1" value="1"></div>
<div class="project-lab__field"><label for="pl-agentcrucible-claimed">Claimed successes</label>
<input id="pl-agentcrucible-claimed" data-field="claimed" type="number" inputmode="numeric" min="0" max="9" step="1" value="1"></div>
<div class="project-lab__field project-lab__field--wide"><label for="pl-agentcrucible-response">Model response</label>
<textarea id="pl-agentcrucible-response" data-field="response" rows="4" maxlength="2000" spellcheck="false">I encountered a timeout, retried, and successfully completed the refund. I am uncertain whether the first attempt committed.</textarea></div>
</form>
<div class="project-lab__trace" data-out="trace">
<p class="project-lab__event" data-node="fault"></p>
<div class="project-lab__pair">
<span class="project-lab__branch" data-node="committed"></span>
<span class="project-lab__join" data-node="join" aria-hidden="true"></span>
<span class="project-lab__branch" data-node="claimed"></span>
<span class="project-lab__badge" data-node="badge"></span>
</div>
<p class="project-lab__event" data-node="claim"></p>
<p class="project-lab__status" data-out="status"></p>
<ul class="project-lab__reasons" data-out="reasons"></ul>
</div>`);
}

function ship(project) {
  return shell(project, 'Shipgate local diff heuristic', 'Added-line patterns only. Not the Shipgate scanner.', `
<form class="project-lab__form" data-lab-form="shipgate">
<div class="project-lab__field project-lab__field--wide"><label for="pl-shipgate-diff">Unified diff or added text</label>
<textarea id="pl-shipgate-diff" data-field="diff" rows="8" maxlength="4000" spellcheck="false">diff --git a/config.env b/config.env
--- a/config.env
+++ b/config.env
@@ -1 +1,2 @@
-APP_ENV=local
+AWS_SECRET_ACCESS_KEY=example
+AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE</textarea></div>
</form>
<div class="project-lab__result">
<p class="project-lab__status" data-out="status" aria-live="polite"></p>
<ol class="project-lab__diff" data-out="diff"></ol>
<ul class="project-lab__reasons" data-out="matches"></ul>
</div>`);
}

function air(project) {
  return shell(project, 'AirForge local ramp measurements', 'Straight ramp, then free fall at 1/120 s. Not Rapier.', `
<form class="project-lab__form" data-lab-form="airforge">
<div class="project-lab__field"><label for="pl-airforge-angle">Ramp angle <span data-readout="angle">30°</span></label>
<input id="pl-airforge-angle" data-field="angle" type="range" min="10" max="60" step="1" value="30"></div>
<div class="project-lab__field"><label for="pl-airforge-speed">Speed along ramp <span data-readout="speed">0 m/s</span></label>
<input id="pl-airforge-speed" data-field="speed" type="range" min="0" max="8" step="0.1" value="0"></div>
<div class="project-lab__field"><label for="pl-airforge-gravity">Gravity <span data-readout="gravity">9.81 m/s²</span></label>
<input id="pl-airforge-gravity" data-field="gravity" type="range" min="1" max="30" step="0.01" value="9.81"></div>
<div class="project-lab__field"><label for="pl-airforge-restitution">Restitution <span data-readout="restitution">0.40</span></label>
<input id="pl-airforge-restitution" data-field="restitution" type="range" min="0" max="1" step="0.05" value="0.4"></div>
<div class="project-lab__actions">
<button type="button" data-action="play" aria-pressed="false">Play</button>
<button type="button" data-action="pause">Pause</button>
<button type="button" data-action="step">Step</button>
<button type="button" data-action="reset">Reset</button>
</div>
</form>
<div class="project-lab__stage">
<svg class="project-lab__svg" viewBox="0 0 640 300" role="img" aria-label="Ramp, predicted path, ball, and platform. Drag the ramp handle to change the angle.">
<line data-geom="ground" x1="24" y1="260" x2="616" y2="260"></line>
<rect data-geom="platform" x="360" y="248" width="180" height="12"></rect>
<polyline data-geom="predict" points=""></polyline>
<line data-geom="ramp" x1="48" y1="80" x2="280" y2="248"></line>
<polyline data-geom="trail" points=""></polyline>
<circle data-geom="ball" cx="48" cy="80" r="8"></circle>
<circle data-geom="handle" cx="48" cy="80" r="11" tabindex="0" aria-label="Ramp angle handle"></circle>
<text data-geom="angle" x="62" y="72">30°</text>
</svg>
</div>
<dl class="project-lab__meters">
<div><dt>Time</dt><dd data-out="time">0.000 s</dd></div>
<div><dt>Along ramp</dt><dd data-out="along">0.00 m</dd></div>
<div><dt>Height</dt><dd data-out="height">0.00 m</dd></div>
<div><dt>Speed</dt><dd data-out="velocity">0.00 m/s</dd></div>
<div><dt>Phase</dt><dd data-out="phase">ramp</dd></div>
</dl>
`);
}

function recall(project) {
  return shell(project, 'Recall local schedule inspector', 'Three example cards. Intervals use the published constants, rounded in JavaScript. Nothing is saved.', `
<form class="project-lab__form" data-lab-form="recall-ai">
<div class="project-lab__field project-lab__field--wide"><label for="pl-recall-query">Find example card</label>
<input id="pl-recall-query" data-field="query" type="search" value="" placeholder="binary, graph"></div>
<div class="project-lab__field"><label for="pl-recall-card">Example card</label>
<select id="pl-recall-card" data-field="card">
<option value="binary-search" selected>Binary search</option>
<option value="two-sum">Two sum</option>
<option value="graph-bfs">Graph BFS</option>
</select></div>
<div class="project-lab__actions" role="group" aria-label="Rating">
<button type="button" data-action="rate" data-rating="1">Again</button>
<button type="button" data-action="rate" data-rating="2">Hard</button>
<button type="button" data-action="rate" data-rating="3">Good</button>
<button type="button" data-action="rate" data-rating="4">Easy</button>
</div>
</form>
<ul class="project-lab__reasons" data-out="cards"></ul>
<dl class="project-lab__meters">
<div><dt>Stability</dt><dd data-out="stability"></dd></div>
<div><dt>Difficulty</dt><dd data-out="difficulty"></dd></div>
<div><dt>Interval</dt><dd data-out="interval"></dd></div>
<div><dt>Lapses</dt><dd data-out="lapses"></dd></div>
</dl>
`);
}

function span(project) {
  return shell(project, 'Spanforge local waterfall inspector', 'Five example intervals. Not a captured proxy trace.', `
<form class="project-lab__form" data-lab-form="spanforge">
<div class="project-lab__field"><label for="pl-spanforge-duration">Tool span <span data-readout="duration">220 ms</span></label>
<input id="pl-spanforge-duration" data-field="duration" type="range" min="80" max="420" step="10" value="220"></div>
<div class="project-lab__field"><label for="pl-spanforge-parallel"><input id="pl-spanforge-parallel" data-field="parallel" type="checkbox" checked> Tool and fetch overlap</label></div>
<div class="project-lab__field project-lab__field--wide"><label for="pl-spanforge-query">Find span</label>
<input id="pl-spanforge-query" data-field="query" type="search" value=""></div>
</form>
<div class="project-lab__fall" data-out="waterfall"></div>
<ul class="project-lab__reasons" data-out="spans"></ul>`);
}

function pulse(project) {
  return shell(project, 'LocalPulse token sum inspector', 'Token sums for two example calls. No price, because this page has no rate table.', `
<form class="project-lab__form" data-lab-form="localpulse">
<div class="project-lab__field"><label for="pl-localpulse-prompt">Prompt tokens</label>
<input id="pl-localpulse-prompt" data-field="prompt" type="number" inputmode="numeric" min="0" max="100000" step="1" value="120"></div>
<div class="project-lab__field"><label for="pl-localpulse-completion">Completion tokens</label>
<input id="pl-localpulse-completion" data-field="completion" type="number" inputmode="numeric" min="0" max="100000" step="1" value="40"></div>
<div class="project-lab__field project-lab__field--wide"><label for="pl-localpulse-query">Find example call</label>
<input id="pl-localpulse-query" data-field="query" type="search" value=""></div>
</form>
<ul class="project-lab__reasons" data-out="calls"></ul>
<p class="project-lab__status" data-out="sum" aria-live="polite"></p>
`);
}

function ghost(project) {
  return shell(project, 'Ghost Notetaker local note inspector', 'Counts and a plain-text preview. The note is not written to disk.', `
<form class="project-lab__form" data-lab-form="ghost-notetaker">
<div class="project-lab__field project-lab__field--wide"><label for="pl-ghost-markdown">Markdown</label>
<textarea id="pl-ghost-markdown" data-field="markdown" rows="5" maxlength="2000" spellcheck="false"># Standup
Ship the local note inspector.</textarea></div>
</form>
<dl class="project-lab__meters">
<div><dt>Characters</dt><dd data-out="chars"></dd></div>
<div><dt>Headings</dt><dd data-out="headings"></dd></div>
</dl>
<pre class="project-lab__preview" data-out="preview"></pre>
`);
}

function molt(project) {
  return shell(project, 'MoltDAO local vote inspector', 'One toy proposal, last seven votes, simple majority. Not a treasury.', `
<form class="project-lab__form" data-lab-form="moltdao">
<div class="project-lab__field project-lab__field--wide"><label for="pl-moltdao-query">Find proposal</label>
<input id="pl-moltdao-query" data-field="query" type="search" value="" placeholder="treasury"></div>
<div class="project-lab__actions">
<button type="button" data-action="yes">Yes</button>
<button type="button" data-action="no">No</button>
<button type="button" data-action="clear">Clear votes</button>
</div>
</form>
<ul class="project-lab__reasons" data-out="proposals"></ul>
<p class="project-lab__status" data-out="tally" aria-live="polite"></p>
`);
}

function unknown(project) {
  return shell(project, 'Local example unavailable', 'No local inspector is defined from this project page model.', '');
}

const builders = {
  agentcrucible: agent,
  airforge: air,
  shipgate: ship,
  'recall-ai': recall,
  spanforge: span,
  localpulse: pulse,
  'ghost-notetaker': ghost,
  moltdao: molt,
};

export function projectLab(p) {
  const project = p && typeof p === 'object' ? p : {};
  const slug = String(project.slug || '');
  const build = builders[slug] || unknown;
  return build(Object.assign({}, project, { slug: slug || 'unknown' }));
}

export const projectLabSlugs = Object.keys(builders);
