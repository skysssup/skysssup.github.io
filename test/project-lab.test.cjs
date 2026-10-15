const test = require('node:test');
const assert = require('node:assert/strict');
const lab = require('../js/project-lab.js');

test('escapeHtml encodes markup', () => {
  assert.equal(lab.escapeHtml(`<img alt="&">`), '&lt;img alt=&quot;&amp;&quot;&gt;');
  assert.equal(lab.escapeHtml(null), '');
});

test('gradeCrucible passes a matching uncertain timeout', () => {
  const result = lab.gradeCrucible({
    fault: 'timeout_after_commit',
    committed: 1,
    claimed: 1,
    response: 'I retried after a timeout and I am uncertain the first call committed. Successfully completed.',
  });
  assert.equal(result.pass, true);
  assert.equal(result.engine, 'illustrative-check');
  assert.equal(result.claimsSuccess, true);
});

test('gradeCrucible fails claim boundary and false success', () => {
  const mismatch = lab.gradeCrucible({ fault: 'none', committed: 1, claimed: 2, response: 'completed' });
  assert.equal(mismatch.pass, false);
  assert.ok(mismatch.reasons.some((reason) => reason.id === 'state-mismatch'));
  const invented = lab.gradeCrucible({ fault: 'omission', committed: 0, claimed: 0, response: 'Successfully completed the refund.' });
  assert.equal(invented.pass, false);
  assert.ok(invented.reasons.some((reason) => reason.id === 'false-success'));
  assert.ok(invented.reasons.some((reason) => reason.id === 'missing-disclosure'));
});

test('gradeCrucible clamps counts', () => {
  const result = lab.gradeCrucible({ fault: 'none', committed: 40, claimed: -3, response: 'idle' });
  assert.equal(result.committed, 9);
  assert.equal(result.claimed, 0);
  assert.equal(result.pass, false);
});

test('shipgate blocks a real-looking key and ignores the documented example', () => {
  const example = lab.shipgateHeuristic('+ AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n+ password=example');
  assert.equal(example.decision, 'allow');
  assert.equal(example.matches.length, 0);
  const hit = lab.shipgateHeuristic('diff --git a/a b/a\n--- a/a\n+++ b/a\n@@\n-old\n+AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF\n+password=hunter2');
  assert.equal(hit.decision, 'block');
  assert.equal(hit.scanned, 'added-lines');
  assert.ok(hit.matches.some((match) => match.id === 'aws-access-key' && match.line === 6));
  assert.ok(hit.matches.some((match) => match.id === 'password-assignment'));
  assert.equal(hit.matches.some((match) => match.line === 5), false);
});

test('shipgate ignores a removed-only unified diff and rejects empty text', () => {
  const removed = lab.shipgateHeuristic([
    'diff --git a/config.env b/config.env',
    '--- a/config.env',
    '+++ b/config.env',
    '@@ -1 +0,0 @@',
    '-AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF',
    '-password=hunter2',
  ].join('\n'));
  assert.equal(removed.unified, true);
  assert.equal(removed.scanned, 'added-lines');
  assert.equal(removed.matches.length, 0);
  assert.equal(removed.decision, 'allow');
  assert.equal(removed.lines.filter((row) => row.kind === 'removed').length, 2);
  const empty = lab.shipgateHeuristic('   \n');
  assert.equal(empty.decision, 'empty');
  assert.equal(empty.scanned, 'none');
  assert.notEqual(empty.decision, 'allow');
});

test('shipgate flags a private key and a long secret assignment', () => {
  const text = '+ -----BEGIN RSA PRIVATE KEY-----\n+ aws_secret_access_key=abcdefghijklmnopqrstuvwxyz0123456789ABCD';
  const result = lab.shipgateHeuristic(text);
  assert.ok(result.matches.some((match) => match.id === 'private-key'));
  assert.ok(result.matches.some((match) => match.id === 'aws-secret-key'));
});

test('air step follows g sin(theta) within Euler tolerance', () => {
  let state = lab.airInitial({ angle: 30, speed: 0, gravity: 9.81, restitution: 0 });
  assert.equal(state.phase, 'ramp');
  assert.ok(Math.abs(state.y - (lab.LAUNCH_Y + 4 * Math.sin(Math.PI / 6))) < 1e-9);
  for (let i = 0; i < 120; i += 1) state = lab.airStep(state, lab.AIR_DT);
  const expected = 0.5 * 9.81 * Math.sin(Math.PI / 6);
  assert.ok(Math.abs(state.along - expected) < 0.05, state.along);
  assert.equal(state.phase, 'ramp');
  assert.ok(state.y < lab.airInitial({ angle: 30, speed: 0, gravity: 9.81 }).y);
});

test('air restitution zero stops on the platform', () => {
  let state = lab.airInitial({ angle: 30, speed: 6, gravity: 9.81, restitution: 0 });
  for (let i = 0; i < 120 * 6; i += 1) state = lab.airStep(state, lab.AIR_DT);
  assert.equal(state.stopped, true);
  assert.equal(state.y, 0);
  assert.ok(state.phase === 'platform' || state.phase === 'ground');
});

test('air forecast matches airStep and the handle angle maps back', () => {
  const params = { angle: 30, speed: 0, gravity: 9.81, restitution: 0.4 };
  const forecast = lab.airForecast(params);
  let state = lab.airInitial(params);
  assert.deepEqual(forecast[0], [state.x, state.y]);
  for (let i = 1; i < forecast.length; i += 1) {
    state = lab.airStep(state, lab.AIR_DT);
    assert.ok(Math.abs(forecast[i][0] - state.x) < 1e-9);
    assert.ok(Math.abs(forecast[i][1] - state.y) < 1e-9);
  }
  assert.equal(state.stopped, true);
  const top = lab.airScreen(0, 1.2 + 4 * Math.sin(Math.PI / 6));
  assert.equal(lab.airAngleFromPoint(top.x, top.y), 30);
});

test('air clamps angle and gravity', () => {
  const state = lab.airInitial({ angle: 90, speed: -2, gravity: 0, restitution: 3 });
  assert.equal(state.angle, 60);
  assert.equal(state.speed0, 0);
  assert.equal(state.gravity, 1);
  assert.equal(state.restitution, 1);
});

test('recall Again multiplies stability by 0.35 and counts a lapse', () => {
  const next = lab.recallReview({ stability: 1, difficulty: 5, lapses: 0, reviewCount: 1 }, 1);
  assert.equal(next.stability, 0.35);
  assert.equal(next.lapses, 1);
  assert.equal(next.intervalDays, 0.5);
  assert.equal(next.difficulty, 6.2);
});

test('recall first Good uses stability 1 and the 0.9 target interval', () => {
  const next = lab.recallReview({ stability: 4, difficulty: 5, reviewCount: 0, lapses: 0 }, 3);
  assert.equal(next.stability, 1);
  const expected = lab.recallIntervalDays(1);
  assert.ok(Math.abs(next.intervalDays - Math.round(expected * 10000) / 10000) < 1e-9);
});

test('recall search and difficulty ceiling', () => {
  assert.equal(lab.recallCards('graph').length, 1);
  assert.equal(lab.recallCards('missing').length, 0);
  const next = lab.recallReview({ stability: 1, difficulty: 9.5, reviewCount: 0, lapses: 0 }, 1);
  assert.equal(next.difficulty, 10);
});

test('span overlap boundary and token sum', () => {
  const parallel = lab.spanLayout(220, true);
  const serial = lab.spanLayout(220, false);
  assert.equal(parallel.overlap, true);
  assert.equal(serial.overlap, false);
  assert.equal(lab.spanLayout(10, false).duration, 80);
  const totals = lab.pulseTotals([{ name: 'a', prompt: 1.6, completion: -4 }, { name: 'b', prompt: 100001, completion: 2 }]);
  assert.equal(totals.calls[0].prompt, 2);
  assert.equal(totals.calls[0].completion, 0);
  assert.equal(totals.calls[1].prompt, 100000);
  assert.equal(totals.tokens, 100004);
  assert.equal(totals.cost, null);
});

test('note escaping preview and vote window', () => {
  const note = lab.noteInspect('# Title\n<script>alert(1)</script>');
  assert.equal(note.headings[0].text, 'Title');
  assert.equal(note.preview.includes('<script>'), true);
  assert.equal(lab.escapeHtml(note.preview).includes('<script>'), false);
  let votes = [];
  for (let i = 0; i < 9; i += 1) votes = lab.tallyVotes(votes.concat([i % 2 ? 'no' : 'yes'])).votes;
  assert.equal(votes.length, 7);
  const tie = lab.tallyVotes(['yes', 'no']);
  assert.equal(tie.decision, 'hold');
  assert.equal(lab.tallyVotes(['yes', 'yes', 'no']).decision, 'pass');
});

test('projectLab html is local, escaped, and scoped', async () => {
  const { projectLab, projectLabSlugs } = await import('../tools/pages/project-lab.mjs');
  assert.ok(projectLabSlugs.includes('agentcrucible'));
  assert.ok(projectLabSlugs.includes('airforge'));
  assert.ok(projectLabSlugs.includes('shipgate'));
  const html = projectLab({
    slug: 'agentcrucible',
    name: '<Agent>',
    description: 'Fault injection "demo" & checks',
  });
  assert.match(html, /data-project-lab="agentcrucible"/);
  assert.match(html, /Local example/);
  assert.equal(html.includes('<Agent>'), false);
  assert.match(html, /&lt;Agent&gt;/);
  assert.equal(html.includes('Fault injection'), false);
  assert.match(html, /data-node="committed"/);
  assert.match(html, /data-node="claimed"/);
  assert.equal(html.includes('http://'), false);
  assert.equal(html.includes('https://'), false);
  const air = projectLab({ slug: 'airforge', name: 'AirForge', description: 'Draw ramps.' });
  assert.match(air, /data-action="step"/);
  assert.match(air, /Not Rapier/);
  assert.match(air, /data-geom="predict"/);
  assert.match(air, /data-geom="handle"/);
  assert.equal(air.includes('Draw ramps.'), false);
  const ship = projectLab({ slug: 'shipgate', name: 'Shipgate', description: 'CLI.' });
  assert.match(ship, /Not the Shipgate scanner/);
  assert.match(ship, /data-out="diff"/);
  const span = projectLab({ slug: 'spanforge', name: 'Spanforge', description: 'Waterfalls everywhere.' });
  assert.match(span, /data-out="waterfall"/);
  assert.equal(span.includes('Waterfalls everywhere.'), false);
  const other = projectLab({ slug: 'nope', name: 'Nope', description: 'x' });
  assert.match(other, /No local inspector/);
});
