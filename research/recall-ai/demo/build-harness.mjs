// Builds harness.html: one offline file (works from file://) that inlines scheduler.mjs, parity.mjs and
// scheduler-cases.json, runs every parity check in the browser, and plots one sequence with the port.
// Usage: node build-harness.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name) => readFileSync(join(here, name), 'utf8')

const scheduler = read('scheduler.mjs')
const exported = [...scheduler.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1])
const inlineScheduler = scheduler.replace(/^export /gm, '')
const inlineParity = read('parity.mjs')
  .replace("import * as S from './scheduler.mjs'", `const S = { ${exported.join(', ')} }`)
  .replace(/^export /gm, '')
const cases = JSON.stringify(JSON.parse(read('scheduler-cases.json'))).replaceAll('</', '<\\/')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recall scheduler port: parity harness</title>
<style>
  :root { color-scheme: dark; --bg: #0b0f14; --panel: #121923; --text: #e6edf5; --muted: #8b9bb0; --ok: #34d399; --bad: #f87171; --line: #2a3442; --accent: #2dd4bf; }
  body { margin: 0; padding: 28px; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { color: var(--muted); margin: 0 0 16px; max-width: 760px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 500; }
  th.num, td.num { text-align: right; }
  #status { font-weight: 600; font-size: 15px; }
  .ok { color: var(--ok); } .bad { color: var(--bad); }
  select { background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; }
  svg text { fill: var(--muted); font-size: 11px; }
</style>
</head>
<body>
<h1>Recall scheduler: JavaScript port vs Python</h1>
<p>Every expected value below was produced by <code>backend/app/scheduler.py</code>. This page recomputes them with
<code>scheduler.mjs</code> in the browser, offline, and compares floats bit-for-bit and timestamps to the microsecond.</p>
<div class="panel"><div id="status">Running…</div><table id="sections"></table></div>
<div class="panel">
  <label>Sequence <select id="seq"></select></label>
  <svg id="curve" viewBox="0 0 900 260" width="100%" role="img" aria-label="Retrievability over time"></svg>
  <table id="steps"></table>
</div>
<script id="cases" type="application/json">${cases}</script>
<script type="module">
${inlineScheduler}
${inlineParity}
const doc = JSON.parse(document.getElementById('cases').textContent)
const t0 = performance.now()
const result = verify(doc)
const ms = (performance.now() - t0).toFixed(1)
const total = result.sections.reduce((n, s) => n + s.checks, 0)
const status = document.getElementById('status')
status.className = result.failures.length ? 'bad' : 'ok'
status.textContent = result.failures.length
  ? \`FAILED: \${result.failures.length} of \${total} checks differ\`
  : \`OK: all \${total} checks identical (\${ms} ms, source \${doc.source} @ \${doc.commit})\`
status.dataset.result = result.failures.length ? 'fail' : 'pass'
document.getElementById('sections').innerHTML = '<tr><th>Function</th><th>Cases</th><th class="num">Checks</th><th class="num">Mismatches</th></tr>' +
  result.sections.map((s) => \`<tr><td>\${s.name}</td><td>\${s.detail}</td><td class="num">\${s.checks}</td><td class="num \${s.mismatches ? 'bad' : 'ok'}">\${s.mismatches}</td></tr>\`).join('')

const select = document.getElementById('seq')
select.innerHTML = doc.sequences.map((s, i) => \`<option value="\${i}">\${s.label}</option>\`).join('')
const fmt = (days) => days < 1 ? \`\${(days * 24).toFixed(1)} h\` : \`\${days.toFixed(2)} d\`
function draw(seq) {
  const reviews = seq.steps.map((st) => ({ rating: st.input.rating, atUs: st.input.current_us }))
  const states = replay(reviews)
  const start = states[0].lastReviewedAtUs
  const end = states.at(-1).dueAtUs
  const span = Math.max(1, (end - start) / US_PER_DAY)
  const W = 900, H = 260, L = 44, R = 12, T = 12, B = 28
  const x = (us) => L + ((us - start) / US_PER_DAY / span) * (W - L - R)
  const lows = states.map((s, i) => retrievability(s.stability, s.lastReviewedAtUs, i + 1 < states.length ? states[i + 1].lastReviewedAtUs : s.dueAtUs))
  const floor = Math.min(0.85, Math.floor((Math.min(...lows) - 0.02) * 20) / 20)
  const y = (r) => T + (1 - (r - floor) / (1 - floor)) * (H - T - B)
  let path = ''
  states.forEach((s, i) => {
    const until = i + 1 < states.length ? states[i + 1].lastReviewedAtUs : s.dueAtUs
    for (let k = 0; k <= 60; k++) {
      const at = s.lastReviewedAtUs + ((until - s.lastReviewedAtUs) * k) / 60
      path += \`\${path ? 'L' : 'M'}\${x(at).toFixed(1)},\${y(retrievability(s.stability, s.lastReviewedAtUs, at)).toFixed(1)}\`
    }
  })
  const marks = states.map((s) => \`<circle cx="\${x(s.lastReviewedAtUs)}" cy="\${y(1)}" r="4" fill="\${['', '#f87171', '#fbbf24', '#34d399', '#60a5fa'][s.rating]}"/>\`).join('')
  document.getElementById('curve').innerHTML =
    \`<line x1="\${L}" x2="\${W - R}" y1="\${y(0.9)}" y2="\${y(0.9)}" stroke="#2dd4bf" stroke-dasharray="4 4"/>\` +
    \`<text x="4" y="\${y(0.9) + 4}">R=0.9</text><text x="4" y="\${y(1) + 4}">1.0</text><text x="4" y="\${y(floor)}">\${floor.toFixed(2)}</text>\` +
    \`<text x="\${L}" y="\${H - 8}">day 0</text><text x="\${W - R - 60}" y="\${H - 8}">day \${span.toFixed(1)}</text>\` +
    \`<path d="\${path}" fill="none" stroke="#e6edf5" stroke-width="1.5"/>\` + marks
  document.getElementById('steps').innerHTML = '<tr><th>#</th><th>Rating</th><th class="num">R before</th><th class="num">S</th><th class="num">D</th><th class="num">Next interval</th><th class="num">Lapses</th><th>Leech</th></tr>' +
    states.map((s, i) => \`<tr><td>\${i + 1}</td><td>\${RATING_LABELS[s.rating]}</td><td class="num">\${seq.steps[i].retrievability_before.toFixed(4)}</td><td class="num">\${s.stability}</td><td class="num">\${s.difficulty}</td><td class="num">\${fmt(s.intervalDays)}</td><td class="num">\${s.lapses}</td><td>\${isLeech(s.lapses) ? 'yes' : ''}</td></tr>\`).join('')
}
select.addEventListener('change', () => draw(doc.sequences[Number(select.value)]))
draw(doc.sequences[0])
</script>
</body>
</html>
`
writeFileSync(join(here, 'harness.html'), html)
console.log(`wrote harness.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB)`)
