// Original vector illustrations of each project's published behavior.
// These are explanatory scenes, not product screenshots or measured runs.
const line = (x1, y1, x2, y2, cls = '') => `<path class="${cls}" d="M${x1} ${y1}L${x2} ${y2}"/>`;
const text = (x, y, value, cls = '') => `<text x="${x}" y="${y}" class="${cls}">${value}</text>`;
const dot = (x, y, r = 2, cls = '') => `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;
const box = (x, y, w, h, label, cls = '') => `<g class="scene-node ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>${text(x + 10, y + 23, label)}${line(x + 10, y + 34, x + w - 10, y + 34, 'faint')}${Array.from({ length: 3 }, (_, i) => line(x + 10, y + 47 + i * 7, x + 16 + (w - 26) * [.8, .52, .68][i], y + 47 + i * 7, 'faint')).join('')}</g>`;
const path = (d, cls = '') => `<path d="${d}" class="${cls}"/>`;
const cross = (x, y, cls = 'faint') => `<g class="${cls}">${line(x - 3, y, x + 3, y)}${line(x, y - 3, x, y + 3)}</g>`;
function frame(slug, label, body) {
  const grid = Array.from({ length: 9 }, (_, i) => line(40 + i * 70, 36, 40 + i * 70, 326, 'grid')).join('') + Array.from({ length: 5 }, (_, i) => line(30, 50 + i * 60, 610, 50 + i * 60, 'grid')).join('');
  const ruler = Array.from({ length: 29 }, (_, i) => line(40 + i * 20, 337, 40 + i * 20, i % 5 ? 340 : 344, 'faint')).join('');
  return `<svg class="scene-svg" viewBox="0 0 640 360" role="img" aria-labelledby="scene-title-${slug}" xmlns="http://www.w3.org/2000/svg"><title id="scene-title-${slug}">${label}</title><g class="scene-grid">${grid}</g><g class="scene-art">${body}</g><g class="scene-registration">${cross(18, 18)}${cross(622, 18)}${cross(18, 342)}${cross(622, 342)}${ruler}${text(38, 23, 'SCHEMATIC', 'faint')}</g><g class="scene-pointer" aria-hidden="true"><circle r="12"/><path d="M-18 0H-8M8 0H18M0-18V-8M0 8V18"/></g><g class="scene-courier" aria-hidden="true"><circle r="4"/><circle r="9" class="courier-halo"/></g></svg>`;
}

function crucible() {
  const nodes = box(38,92,122,88,'tool call') + box(184,92,122,88,'retry') + box(350,92,122,88,'state') + box(506,92,100,88,'check');
  return frame('agentcrucible', 'Fault injection, retry, committed state, and claim checking', `${nodes}<g class="scene-flow">${path('M100 180H245H410H556', 'flow-line')}${dot(100,180)}${dot(245,180)}${dot(410,180)}${dot(556,180)}</g>${path('M245 180V272H410V180','flow-line')}${text(267,300,'retry before checking','accent')}${line(245,48,245,180,'fault-marker')}${text(255,65,'timeout','fault-marker accent')}${dot(245,180,5,'fault-marker accent-fill')}${text(38,54,'request')}${text(505,54,'claim')}${path('M556 182V232H410','faint dashed')}${text(421,254,'compare state','faint')}`);
}

function airforge() {
  const tracks = Array.from({ length: 12 }, (_, i) => path(`M82 ${88 + i * 8}Q216 ${146 + i * 5} 315 ${221 + i * 2}`, 'contour')).join('');
  return frame('airforge', 'A sketched ramp, a falling ball, and a platform', `${tracks}${path('M78 94L308 226', 'strong')}${path('M330 292H573V302H330Z', 'platform')}${path('M109 75L307 188Q365 224 405 282Q450 242 484 282Q511 264 535 282', 'trajectory faint dashed')}${line(72, 312, 590, 312, 'faint')}${Array.from({ length: 20 }, (_, i) => line(79 + i * 26, 312, 73 + i * 26, 319, 'faint')).join('')}${dot(109, 75, 10, 'physics-ball')}${dot(109, 75, 2, 'accent-fill')}${text(53, 51, 'draw')}${text(251, 181, 'ramp', 'accent')}${text(486, 327, 'platform')}${path('M578 88V153M573 145L578 154L583 145', 'faint')}${text(548, 72, 'gravity', 'faint')}${text(51, 327, 'sketch → bodies → simulate', 'faint')}`);
}

function shipgate() {
  const diff = Array.from({ length: 15 }, (_, i) => `${text(53, 80 + i * 13, String(i + 1).padStart(2, '0'), 'faint diff-number')}${line(85, 76 + i * 13, 125 + ((i * 37) % 95), 76 + i * 13, i === 5 || i === 6 ? 'accent' : 'faint')}`).join('');
  const rails = Array.from({ length: 11 }, (_, i) => path(`M223 ${98 + i * 11}C270 ${98 + i * 11} 267 ${143 + i * 2} 310 ${143 + i * 2}H422C470 ${143 + i * 2} 478 ${98 + i * 11} 583 ${98 + i * 11}`, 'contour')).join('');
  return frame('shipgate', 'Staged Git changes pass through local policy checks before commit and push', `${diff}${rails}${box(310, 102, 112, 86, 'policy gate')}${text(330, 220, 'scan staged diff', 'accent')}${path('M48 62H222V275H48Z', 'faint')}${text(58, 55, 'staged')}${text(483, 55, 'commit / push')}${path('M350 189V270H528V230', 'dashed blocked-route')}${dot(528, 230, 6, 'accent-fill blocked-route')}${text(383, 292, 'blocked by policy', 'blocked-route accent')}${text(52, 305, 'local checks, before publishing', 'faint')}`);
}

function recall() {
  const curves = Array.from({ length: 8 }, (_, i) => {
    const high = 88 + i * 13;
    return path(`M66 266C102 ${high} 165 ${high} 228 248S353 ${high + 7} 403 248S505 ${high + 7} 576 248`, 'contour');
  }).join('');
  const events = [84, 163, 263, 408, 560].map((x, i) => `${line(x, 63, x, 285, 'faint dashed')}${dot(x, 252, 4, i === 1 ? 'accent-fill recall-active' : '')}${text(x - 10, 303, ['learn', 'again', 'review', 'review', 'review'][i], 'faint')}`).join('');
  return frame('recall-ai', 'Spaced repetition schedules algorithm practice locally', `${curves}${events}${line(58, 275, 592, 275)}${path('M163 75V267', 'accent recall-marker')}${text(60, 49, 'retention / review intervals')}${text(431, 329, 'stored in SQLite', 'faint')}${text(67, 329, 'practice → review → reschedule', 'faint')}${text(460, 67, 'local-first', 'accent')}`);
}

function spanforge() {
  const spans = [[0, 22, 575, 'request'], [1, 41, 305, 'plan'], [2, 105, 221, 'tool'], [2, 259, 78, 'fetch'], [1, 352, 170, 'finalize']];
  const bars = spans.map(([depth, x, w, name], i) => `<g class="trace-span" style="--order:${i}">${text(42 + depth * 10, 87 + i * 41, name, 'faint')}<rect x="${150 + x * .6}" y="${72 + i * 41}" width="${w * .65}" height="17" rx="1"/>${line(150 + x * .6, 98 + i * 41, 150 + (x + w) * .6, 98 + i * 41, 'faint')}</g>`).join('');
  return frame('spanforge', 'A local trace proxy shows the nesting and overlap of LLM spans', `${text(42, 47, 'span waterfall')}${bars}${Array.from({ length: 7 }, (_, i) => `${line(151 + i * 63, 54, 151 + i * 63, 290, 'grid')}${text(150 + i * 63, 314, String(i), 'faint')}`).join('')}${path('M116 86V250M116 125H129M116 166H139M116 206H139M116 247H129', 'faint')}${text(40, 333, 'request → spans → inspect', 'faint')}${text(474, 333, 'local proxy', 'accent')}`);
}

function localpulse() {
  const bars = Array.from({ length: 38 }, (_, i) => {
    const h = 13 + ((i * 71 + (i % 5) * 23) % 110);
    return `<rect x="${47 + i * 9}" y="${244 - h}" width="3" height="${h}" class="pulse-bar" style="--order:${i}"/>`;
  }).join('');
  const wave = Array.from({ length: 42 }, (_, i) => `${i ? 'L' : 'M'}${46 + i * 8.3} ${127 + Math.sin(i * .39) * 26 + Math.sin(i * 1.1) * 9}`).join('');
  return frame('localpulse', 'LLM call metadata is collected to disk and inspected as token, latency, and cost views', `${text(47, 51, 'collect / persist / inspect')}${line(45, 244, 395, 244)}${bars}${path(wave, 'accent pulse-wave')}${text(47, 274, 'illustrative call series', 'faint')}${box(442, 76, 130, 79, 'tokens')}${box(442, 185, 130, 79, 'latency / cost')}${path('M394 131H420V113H441M394 242H420V221H441', 'faint dashed')}${text(47, 319, 'caller metadata stays local', 'faint')}`);
}

function ghost() {
  const lines = (x, y, n) => Array.from({ length: n }, (_, i) => line(x, y + i * 12, x + 35 + ((i * 29) % 75), y + i * 12, 'faint')).join('');
  return frame('ghost-notetaker', 'Quick capture creates local Markdown notes and arranges them into workspaces', `${path('M77 85H254V249H77Z', 'note-sheet')}${path('M91 71H267V234', 'faint')}${text(94, 115, '# quick capture')}${lines(94, 144, 7)}${path('M327 112H546V278H327Z', 'note-sheet accent')}${text(346, 143, 'workspace')}${lines(345, 171, 7)}${path('M254 169H326', 'flow-line')}${dot(283, 169, 3, 'capture-dot accent-fill')}${path('M310 164L318 169L310 174')}${text(69, 52, 'clipboard → note → workspace')}${text(330, 306, 'Markdown · workspaces', 'faint')}`);
}

function molt() {
  const nodes = Array.from({ length: 7 }, (_, i) => { const a = i * Math.PI * 2 / 7 - Math.PI / 2; return [320 + Math.cos(a) * 116, 178 + Math.sin(a) * 116]; });
  const edges = nodes.map(([x, y], i) => `${line(x, y, 320, 178, 'vote-link')}${line(x, y, ...nodes[(i + 2) % 7], 'faint')}${dot(x, y, 5, 'voter')}${dot(x, y, 13, 'faint')}`).join('');
  return frame('moltdao', 'Agents propose and vote on treasury actions in a toy local-chain experiment', `${edges}${dot(320, 178, 38)}${dot(320, 178, 45, 'faint dashed')}${text(295, 182, 'treasury')}${text(68, 59, 'proposal')}${path('M82 70H181L209 90', 'faint')}${text(484, 283, 'vote')}${path('M474 279H451L426 245', 'faint')}${text(46, 329, 'propose → vote → execute', 'faint')}${text(466, 329, 'local experiment', 'accent')}`);
}

export const scenes = {
  agentcrucible: { label: 'Fault injection', action: 'Inject fault', active: 'Clear fault', svg: crucible() },
  airforge: { label: 'Sketch to physics', action: 'Drop', active: 'Reset', svg: airforge() },
  shipgate: { label: 'Git policy gate', action: 'Scan changes', active: 'Reset scan', svg: shipgate() },
  'recall-ai': { label: 'Review scheduling', action: 'Review', active: 'Reset review', svg: recall() },
  spanforge: { label: 'Trace waterfall', action: 'Trace request', active: 'Reset trace', svg: spanforge() },
  localpulse: { label: 'Local call metrics', action: 'Collect', active: 'Reset series', svg: localpulse() },
  'ghost-notetaker': { label: 'Quick capture', action: 'Capture note', active: 'Reset notes', svg: ghost() },
  moltdao: { label: 'Agent governance', action: 'Cast vote', active: 'Reset votes', svg: molt() }
};

// Timed, explanatory states. These describe the drawing, never a measured product run.
const behavior = {
  agentcrucible: { idle: 'Tool call → committed state → checked claim', steps: [[0, 'Tool call times out'], [520, 'Retry follows the lower route'], [1250, 'Claim checked against committed state']], points: [[100,180],[245,180],[330,272],[556,180]] },
  airforge: { idle: 'Draw a ramp, then drop the ball', steps: [[0, 'Ball released'], [650, 'Ramp guides the fall'], [1700, 'Ball settles on the platform']], points: [[109,75],[308,226],[425,282],[535,282]] },
  shipgate: { idle: 'Staged changes pass through the policy gate', steps: [[0, 'Read staged diff'], [450, 'Evaluate local policy'], [1050, 'Policy blocks this illustrative change']], points: [[135,162],[365,145],[528,230]] },
  'recall-ai': { idle: 'Review shifts the next practice interval', steps: [[0, 'Review recorded'], [380, 'Retention curve updated'], [850, 'Next review moves along the timeline']], points: [[84,252],[163,252],[263,252],[408,252],[560,252]] },
  spanforge: { idle: 'Nested spans share a request timeline', steps: [[0, 'Request begins'], [360, 'Tool and fetch spans overlap'], [1100, 'Finalize closes the request']], points: [[340,80],[280,121],[305,162],[331,203],[416,244]] },
  localpulse: { idle: 'Call series → local store → metric views', steps: [[0, 'Call metadata collected'], [450, 'Series written locally'], [1200, 'Token and latency views receive the series']], points: [[220,130],[390,242],[505,115],[505,224]] },
  'ghost-notetaker': { idle: 'Capture becomes a local Markdown note', steps: [[0, 'Quick capture received'], [350, 'Markdown note created'], [900, 'Note joins the workspace']], points: [[164,165],[285,169],[430,200]] },
  moltdao: { idle: 'Proposal → votes → treasury action', steps: [[0, 'Illustrative proposal submitted'], [500, 'Agent votes converge'], [1200, 'Local experiment reaches a treasury decision']], points: [[320,62],[430,153],[271,283],[320,178]] }
};
const inspections = {
  agentcrucible: ['Tool call enters the fault test', 'Injected timeout interrupts the call', 'Retry returns through the lower route', 'Claim compared with committed state'],
  airforge: ['Ball begins above the ramp', 'Drawn stroke becomes a collision body', 'Ball reaches the platform', 'Bounce loses height before settling'],
  shipgate: ['Only staged changes enter the scan', 'Local rules evaluate the staged diff', 'A blocked result stops publication'],
  'recall-ai': ['First practice', 'Another attempt', 'Next scheduled review', 'A longer review interval', 'Later review, stored locally'],
  spanforge: ['Parent request spans the timeline', 'Planning is nested in the request', 'Tool span shares its parent', 'Fetch overlaps the tool work', 'Finalize completes the request'],
  localpulse: ['Illustrative call series', 'Metadata persists locally', 'Token view', 'Latency and cost view'],
  'ghost-notetaker': ['Local Markdown note', 'Capture enters the workspace', 'Workspace organizes the notes'],
  moltdao: ['Proposal enters the local experiment', 'Agent vote', 'Votes converge on the treasury', 'Toy-chain treasury decision']
};
Object.entries(scenes).forEach(([slug, scene]) => Object.assign(scene, behavior[slug], { inspect: inspections[slug] }));
