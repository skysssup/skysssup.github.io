const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const lab = require('../js/lab-controls.js');

test('timeout retry matches the claim and a duplicate call does not', () => {
  const timeout = lab.crucible('timeout');
  const duplicate = lab.crucible('duplicate');
  const clear = lab.crucible('none');
  const unknown = lab.crucible('mystery');

  assert.equal(timeout.route, 'retry');
  assert.equal(timeout.committed, timeout.claimed);
  assert.equal(timeout.checked, 'match');
  assert.equal(duplicate.committed, 2);
  assert.equal(duplicate.claimed, 1);
  assert.equal(duplicate.checked, 'mismatch');
  assert.equal(clear.route, 'direct');
  assert.equal(clear.committed, 1);
  assert.notEqual(timeout.route, clear.route);
  assert.deepEqual(unknown, timeout);
  [timeout, duplicate, clear].forEach((result) => {
    assert.ok(Number.isFinite(result.committed));
    assert.ok(Number.isFinite(result.attempts));
  });
});

test('staged diff preview switches between allow and block', () => {
  const samples = [
    ['fix the readme typo', 'allow'],
    ['AWS_SECRET_ACCESS_KEY=AKIAEXAMPLE', 'block'],
    ['BEGIN PRIVATE KEY', 'block'],
    ['password = "hunter2"', 'block'],
    ['+ public comment only', 'allow'],
    ['', 'allow'],
  ];
  const seen = new Set();
  samples.forEach(([text, decision]) => {
    const result = lab.previewDiff(text);
    assert.equal(result.decision, decision, text);
    assert.equal(result.illustration, true);
    seen.add(result.decision);
    if (decision === 'block') assert.ok(result.rules.length > 0);
    else assert.deepEqual(result.rules, []);
  });
  assert.deepEqual([...seen].sort(), ['allow', 'block']);

  const secret = lab.previewDiff('note\nAWS_SECRET_ACCESS_KEY=AKIAEXAMPLE');
  const edited = lab.previewDiff('note\n+ public comment only');
  assert.equal(secret.decision, 'block');
  assert.equal(edited.decision, 'allow');
  assert.equal(lab.previewDiff('x'.repeat(500) + 'AWS_SECRET_ACCESS_KEY=AKIAEXAMPLE').decision, 'allow');
});

test('again and good produce different finite review intervals', () => {
  const start = lab.defaults.review;
  const again = lab.review(start, 'again');
  const good = lab.review(again, 'good');
  assert.equal(again.interval, 1);
  assert.ok(good.interval > again.interval);
  assert.notEqual(lab.intervalX(again.interval), lab.intervalX(good.interval));
  assert.notEqual(lab.retentionPath(0, again.ease), lab.retentionPath(0, good.ease));
  assert.ok(again.ease < start.ease);
  assert.ok(good.ease > again.ease);

  let worn = start;
  for (let i = 0; i < 40; i += 1) worn = lab.review(worn, 'again');
  assert.equal(worn.ease, 1.3);
  assert.equal(worn.interval, 1);
  let strong = start;
  for (let i = 0; i < 40; i += 1) strong = lab.review(strong, 'good');
  assert.ok(strong.ease <= 3);
  assert.ok(strong.interval <= 365);
  assert.ok(strong.interval >= 1);
});

test('duration and parallel change the waterfall without unbounded span rects', () => {
  const shortRun = lab.traceLayout(80, true);
  const longRun = lab.traceLayout(420, true);
  const queued = lab.traceLayout(420, false);
  assert.ok(longRun.spans[2].width > shortRun.spans[2].width);
  assert.ok(longRun.request > shortRun.request);
  const sideFetch = longRun.spans[3];
  const queuedFetch = queued.spans[3];
  const tool = queued.spans[2];
  assert.notEqual(sideFetch.x, queuedFetch.x);
  assert.equal(lab.spansOverlap(longRun.spans[2], sideFetch), true);
  assert.equal(lab.spansOverlap(tool, queuedFetch), false);
  [shortRun, longRun, queued].forEach((layout) => {
    layout.spans.forEach((span) => {
      assert.ok(Number.isFinite(span.x) && Number.isFinite(span.width));
      assert.ok(span.width > 0);
      assert.ok(span.x + span.width <= 624);
    });
  });
  assert.deepEqual(lab.traceLayout(1, true).duration, 80);
  assert.deepEqual(lab.traceLayout(9999, false).duration, 420);
});

test('token calls aggregate only the entered series', () => {
  const first = lab.addTokens([], '12');
  const second = lab.addTokens(first.series, 7);
  assert.equal(first.sum, 12);
  assert.equal(second.sum, 19);
  assert.deepEqual(second.series, [12, 7]);
  assert.equal(lab.addTokens(second.series, -40).sum, 19);
  assert.equal(lab.addTokens([], '1e9').series[0], 100000);
  assert.equal(lab.addTokens([], 'nope').sum, 0);
  const many = Array.from({ length: 50 }, () => 1);
  const capped = many.reduce((series) => lab.addTokens(series, 1).series, []);
  assert.equal(capped.length, 38);
  assert.equal(lab.wavePath([12, 7]).startsWith('M'), true);
  assert.equal(lab.wavePath([]), '');
});

test('note text stays literal and bounded', () => {
  const payload = 'Keep <script>alert(1)</script> & <b>bold</b> literal';
  const note = lab.noteText(payload + '\u0000\nnext');
  assert.equal(note.text.includes('<script>alert(1)</script>'), true);
  assert.equal(note.text.includes('\u0000'), false);
  assert.equal(note.empty, false);
  assert.equal(lab.noteText('   ').empty, true);
  assert.equal(lab.noteText('a'.repeat(500)).text.length, 280);
});

test('yes and no votes reach opposite majorities inside seven seats', () => {
  let box = lab.tally([]);
  for (let i = 0; i < 4; i += 1) box = lab.castVote(box.votes, 'yes');
  assert.equal(box.yes, 4);
  assert.equal(box.no, 0);
  assert.equal(box.majority, 'yes');
  assert.equal(box.decision, 'pass');
  for (let i = 0; i < 7; i += 1) box = lab.castVote(box.votes, 'no');
  assert.equal(box.votes.length, 7);
  assert.equal(box.yes, 0);
  assert.equal(box.no, 7);
  assert.equal(box.majority, 'no');
  assert.equal(box.decision, 'reject');
  const tie = lab.tally(['yes', 'no']);
  assert.equal(tie.majority, 'tie');
  assert.equal(tie.decision, 'hold');
});

test('ramp angle changes a finite landing and the default reaches the platform', () => {
  const published = lab.simulateRamp(lab.defaults.incline);
  const shallow = lab.simulateRamp(10);
  const steep = lab.simulateRamp(50);
  assert.equal(published.landing.where, 'platform');
  assert.equal(published.angle, 30);
  assert.ok(Math.hypot(shallow.landing.x - steep.landing.x, shallow.landing.y - steep.landing.y) > 4);
  assert.notEqual(lab.rampPath(10, 0), lab.rampPath(50, 0));
  [published, shallow, steep, lab.simulateRamp(Number.NaN), lab.simulateRamp(999)].forEach((run) => {
    assert.ok(run.samples.length > 1 && run.samples.length <= 241);
    run.samples.forEach((point) => {
      assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]));
      assert.ok(point[0] >= 30 && point[0] <= 610);
      assert.ok(point[1] >= 30 && point[1] <= 330);
    });
  });
});

test('a paused clock does not absorb hidden time', () => {
  const started = { elapsed: 1.25, last: 1000 };
  const held = lab.stepClock(started, 11000, true);
  assert.equal(held.elapsed, 1.25);
  assert.equal(held.dt, 0);
  const jumped = lab.stepClock(started, 11000, false);
  assert.equal(jumped.dt, 0.032);
  assert.equal(jumped.elapsed, 1.28);
  const next = lab.stepClock(jumped, 11016, false);
  assert.ok(next.dt > 0 && next.dt <= 0.032);
});

test('lab markup is compact, labeled, and local to each project', async () => {
  const { labControls, labSlugs } = await import(pathToFileURL('../tools/pages/labs.mjs'));
  assert.deepEqual(labSlugs, [
    'agentcrucible', 'airforge', 'shipgate', 'recall-ai', 'spanforge', 'localpulse', 'ghost-notetaker', 'moltdao',
  ]);
  assert.equal(labControls('missing'), '');
  const html = Object.fromEntries(labSlugs.map((slug) => [slug, labControls(slug)]));
  for (const slug of labSlugs) {
    assert.match(html[slug], new RegExp(`class="lab-controls" data-lab-controls data-lab-slug="${slug}"`));
    assert.match(html[slug], /role="group"/);
    assert.match(html[slug], /illustration/i);
    assert.match(html[slug], /class="lab-output"/);
    assert.equal((html[slug].match(/data-lab-control=/g) || []).length <= 2, true);
  }
  assert.equal((html.airforge.match(/type="range"/g) || []).length, 1);
  assert.match(html.airforge, /data-lab-control="incline"/);
  assert.match(html.airforge, /data-lab-action="drop"/);
  assert.match(html.spanforge, /data-lab-control="duration"/);
  assert.match(html.spanforge, /data-lab-control="parallel"/);
  assert.match(html.shipgate, /<textarea/);
  assert.match(html.shipgate, /not a complete safety scanner|not a scanner|Blocks a cloud secret/i);
  assert.match(html['recall-ai'], /data-lab-action="again"/);
  assert.match(html['recall-ai'], /data-lab-action="good"/);
  assert.match(html.localpulse, /data-lab-action="add"/);
  assert.match(html['ghost-notetaker'], /<textarea/);
  assert.match(html['ghost-notetaker'], /data-lab-action="capture"/);
  assert.match(html['ghost-notetaker'], /data-lab-action="copy"/);
  assert.match(html.moltdao, /data-lab-action="yes"/);
  assert.match(html.moltdao, /data-lab-action="no"/);
  assert.match(html.agentcrucible, /value="timeout"/);
  assert.doesNotMatch(html.shipgate, /<script/i);
});

function pathToFileURL(relative) {
  return require('node:url').pathToFileURL(path.join(__dirname, relative)).href;
}
