const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const hero = require('../js/hero.js');

test('the hash is deterministic and spreads evenly over [0, 1)', () => {
  assert.equal(hero.hash(42), hero.hash(42));
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 20000; i++) {
    const v = hero.hash(i);
    assert.ok(v >= 0 && v < 1);
    buckets[Math.floor(v * 10)]++;
  }
  for (const b of buckets) assert.ok(b > 1700 && b < 2300, `bucket ${b}`);
});

test('Gear Two heartbeat beats twice per 0.9 s and rests in between', () => {
  const samples = Array.from({ length: 90 }, (_, i) => hero.heartbeat(i / 100));
  const peaks = samples.filter((v, i) => i > 0 && i < samples.length - 1 && v > samples[i - 1] && v >= samples[i + 1] && v > 0.3);
  assert.equal(peaks.length, 2);
  assert.ok(hero.heartbeat(0.6) < 0.05);
  assert.ok(Math.abs(hero.heartbeat(0.08) - hero.heartbeat(0.98)) < 1e-9);
});

test('Gear Two tears on about a third of its heartbeats, with a long tear about every 6 s, the same way every time', () => {
  const beats = 7000, plans = Array.from({ length: beats }, (_, b) => hero.tearSchedule(b));
  assert.deepEqual(plans, Array.from({ length: beats }, (_, b) => hero.tearSchedule(b)), 'deterministic per beat');
  const long = plans.map((p, b) => [p, b]).filter(([p]) => p && p.long).map(([, b]) => b);
  const short = plans.filter(p => p && !p.long);
  const share = short.length / (beats - long.length);
  assert.ok(share > 0.32 && share < 0.38, `short tears on ${share} of the other beats`);
  for (const p of short) {
    assert.ok(p.frames >= 2 && p.frames <= 4 && (p.tiles === 1 || p.tiles === 2), `short tear ${JSON.stringify(p)}`);
    assert.equal(p.glitch, 0.6);
    assert.equal(p.after, false, 'short tears leave no afterimage');
  }
  for (let block = 0; block < beats / 7; block++) assert.equal(long.filter(b => Math.floor(b / 7) === block).length, 1, `one long tear in block ${block}`);
  const gaps = long.slice(1).map((b, i) => (b - long[i]) * 0.9);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  assert.ok(Math.abs(mean - 6.3) < 0.1 && Math.min(...gaps) >= 4.5 && Math.max(...gaps) <= 8.1, `long tears every ${mean} s (${Math.min(...gaps)}-${Math.max(...gaps)})`);
  assert.deepEqual(hero.tearSchedule(long[0]), { frames: 8, tiles: 3, glitch: 0.8, after: true, long: true });
});

test('the sheen fires as the assembly finishes, then at each turn of the sway, alternating sides', () => {
  const triggers = [];
  for (let c = 0, last = -1; c <= 70; c += 0.005) {
    const s = hero.sheenPhase(c);
    if (s.index !== last) { triggers.push(s); last = s.index; }
  }
  assert.equal(hero.sheenPhase(1.89).index, -1, 'nothing before the assembly has finished');
  assert.deepEqual(triggers.map(s => s.index), triggers.map((_, i) => i), 'triggers are numbered in order, none skipped');
  assert.equal(triggers[0].at, 1.9, 'the first sweep comes as the assembly finishes');
  const turns = triggers.slice(1);
  for (let period = 1; period < 5; period++) assert.equal(turns.filter(s => s.at >= period * 14 && s.at < (period + 1) * 14).length, 2, `two turns in period ${period}`);
  const h = 1e-3;
  for (const s of turns) {
    const before = hero.sway(s.at) - hero.sway(s.at - h), after = hero.sway(s.at + h) - hero.sway(s.at);
    assert.ok(before * after < 0, `the sway's yaw reverses at ${s.at}`);
    assert.equal(s.dir, Math.sign(before), 'the band travels the way the figure was turning');
  }
  triggers.slice(1).forEach((s, i) => assert.equal(s.dir, -triggers[i].dir, 'directions alternate, from the assembly on'));
  assert.equal(hero.easeInOut(0), 0);
  assert.equal(hero.easeInOut(0.5), 0.5);
  assert.equal(hero.easeInOut(1), 1);
  assert.ok(hero.easeInOut(0.1) < 0.1 && hero.easeInOut(0.9) > 0.9, 'slow at both ends');
});

test('the spring settles on its target without overshooting, at any frame time', () => {
  for (const dt of [1 / 240, 1 / 60, 1 / 20, 0.05]) {
    const s = { x: 0, v: 0 };
    let max = 0;
    for (let t = 0; t < 4; t += dt) { hero.spring(s, 1, dt, 6); max = Math.max(max, s.x); }
    assert.ok(Math.abs(s.x - 1) < 1e-3, `dt ${dt} ended at ${s.x}`);
    assert.ok(max <= 1 + 1e-9, `dt ${dt} overshot to ${max}`);
  }
});

test('a ripple is a band that travels outward and fades out', () => {
  const at = (d, a) => hero.rippleWeight(d, a, 900, 46, 1.3);
  assert.ok(at(90, 0.1) > 0.85);
  assert.ok(at(450, 0.5) > at(90, 0.5));
  assert.ok(at(450, 0.5) < at(90, 0.1));
  assert.equal(at(100, -0.01), 0);
  assert.equal(at(100, 1.31), 0);
  assert.ok(at(0, 0.5) < 1e-6);
});

test('dots drift away and fade instead of blinking off: about 1.5% of their light is away at any moment, and it goes and comes back smoothly', () => {
  let away = 0, total = 0;
  for (let id = 0; id < 2000; id++) for (let k = 0; k < 40; k++) { total++; away += 1 - hero.fadeAway(id, k * 0.37, 1).show; }
  const share = away / total;
  assert.ok(share > 0.008 && share < 0.025, `share ${share}`);
  let doubled = 0;
  for (let id = 0; id < 2000; id++) for (let k = 0; k < 40; k++) doubled += 1 - hero.fadeAway(id, k * 0.37, 2).show;
  assert.ok(doubled / total > share * 1.5, 'Gear Two drifts more often');
  let jump = 0, drifted = 0;
  for (let id = 0; id < 300; id++) {
    for (let t = 0; t < 30; t += 1 / 60) {
      const now = hero.fadeAway(id, t, 1), next = hero.fadeAway(id, t + 1 / 60, 1);
      if (now.drift > 0 && next.drift > 0) jump = Math.max(jump, Math.abs(next.show - now.show));
      if (now.drift > 0.9) drifted++;
    }
  }
  assert.ok(jump < 0.1, `a dot never switches off between two frames at 60 fps (largest step ${jump.toFixed(3)})`);
  assert.ok(drifted > 0, 'and it moves while it fades');
  assert.deepEqual(hero.fadeAway(5, 12.3, 0), { show: 1, drift: 0 }, 'nothing drifts when the rate is 0');
});

test('stippling keeps dots where the ink beats the threshold and nowhere else', () => {
  const size = 8, rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    rgba[i] = 200;
    rgba[i + 1] = x < 4 ? 255 : 0;
    rgba[i + 2] = 255;
  }
  const noise = Uint8Array.from({ length: 16 }, (_, i) => i * 16);
  const pts = hero.stipple(rgba, size, noise, 4, 32, 1, 0);
  assert.equal(pts.length % 3, 0);
  assert.ok(pts.length > 0);
  // ink is 1 in map columns 0-3 and 0 from column 4; bilinear sampling fades it out by u = 4 of 7
  for (let i = 0; i < pts.length; i += 3) {
    assert.ok(pts[i] * 7 < 4 + 1e-6, `dot at x=${pts[i]} lies where the ink is zero`);
    assert.ok(pts[i + 2] > 0 && pts[i + 2] <= 1, 'each dot carries the ink under it');
  }
  assert.ok(Array.from({ length: pts.length / 3 }, (_, i) => pts[i * 3]).some(x => x < 0.25), 'the inked side is stippled');
  const again = hero.stipple(rgba, size, noise, 4, 32, 1, 0.7);
  assert.deepEqual(Array.from(again), Array.from(hero.stipple(rgba, size, noise, 4, 32, 1, 0.7)));
});

test('denser grids for bigger figures, within limits', () => {
  assert.equal(hero.resolutionFor(100), 320);
  assert.equal(hero.resolutionFor(5000), 1200);
  assert.equal(hero.resolutionFor(760), 1064, 'a little more than one cell per pixel of the figure');
  assert.ok(hero.resolutionFor(700) > hero.resolutionFor(400));
});

test('the figure is centred in its box with the requested margin', () => {
  const placed = hero.fit([0.1, 0.2, 0.7, 0.9], 700, 14);
  const w = 0.6 * placed.scale, h = 0.7 * placed.scale;
  assert.ok(Math.abs(h - (700 - 28)) < 1e-9);
  assert.ok(Math.abs(placed.x + 0.1 * placed.scale - (700 - w) / 2) < 1e-9);
  assert.ok(Math.abs(placed.y + 0.2 * placed.scale - 14) < 1e-9);
});

test('the ring repeats the whole line, closes each repeat with a middle dot, and never cuts a word', () => {
  const line = 'I STOLE APOLLO’S CATTLE ON DAY ONE.  YOUR AGENT WON’T SNEAK ONE PAST ME';
  const lap = 'I STOLE APOLLO’S CATTLE ON DAY ONE. YOUR AGENT WON’T SNEAK ONE PAST ME · ';
  const ring = hero.ringText(line, 2000, 8);
  assert.equal(ring.reps, Math.round(2000 / (lap.length * 8)));
  assert.equal(ring.glyphs.join(''), lap.repeat(ring.reps), 'whole repeats, runs of spaces collapsed');
  const words = ring.glyphs.join('').split(/[\s·]+/).filter(Boolean);
  for (const w of words) assert.ok(line.split(/\s+/).includes(w), `fragment "${w}"`);
  assert.equal(hero.ringText(line, 10, 8).reps, 1, 'a short ring still carries the line once');
  assert.equal(hero.ringText(line, 6000, 8).glyphs.filter(c => c === '·').length, hero.ringText(line, 6000, 8).reps);
});

test('rotation keeps lengths, and perspective magnifies what is nearer', () => {
  const p = hero.rotate([0.3, -0.2, 0.1], 0.4, -0.15);
  assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(0.3, -0.2, 0.1)) < 1e-12);
  assert.ok(hero.project([0, 0, 0.2])[2] > hero.project([0, 0, -0.2])[2]);
});

test('a sheen sweeps the turned figure from the key light at the upper left, in front, to the lower right, behind', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'hero', 'hero.json'), 'utf8'));
  const [x0, y0, x1] = meta.bounds, [cx, cy] = meta.center, M = hero.WAY_MARGIN, relief = 0.34;
  assert.ok(Math.abs(Math.hypot(...hero.WAY) - 1) < 1e-12 && hero.WAY[0] > 0 && hero.WAY[1] < 0 && hero.WAY[2] < 0, 'right, down, and away');
  // the corners of the box the sweep is fitted to: the statue's bounds and a little either side, the clouds below, its relief
  const corner = (x, y, z) => [x - cx, cy - y, (z - 0.62) * relief];
  const near = corner(x0 - 0.04, y0, 1), far = corner(x1 + 0.04, 1, 0);
  for (const yaw of [-0.3, 0, 0.3]) for (const pitch of [-0.07, 0, 0.07]) {
    const lane = hero.sheenWay(meta, yaw, pitch), at = q => hero.wayAt(hero.rotate(q, yaw, pitch), lane);
    assert.ok(lane.k > 0);
    const all = [];
    for (const x of [x0 - 0.04, x1 + 0.04]) for (const y of [y0, 1]) for (const z of [0, 1]) all.push(at(corner(x, y, z)));
    assert.ok(Math.abs(Math.min(...all) - M / (1 + 2 * M)) < 1e-9, `the band starts a margin before the figure (yaw ${yaw}, pitch ${pitch})`);
    assert.ok(Math.abs(Math.max(...all) - (1 + M) / (1 + 2 * M)) < 1e-9, `and leaves it a margin after (yaw ${yaw}, pitch ${pitch})`);
    assert.ok(Math.abs(at(near) - M / (1 + 2 * M)) < 0.03, `the corner at the upper left, in front, is reached first (${at(near)})`);
    assert.ok(Math.abs(at(far) - (1 + M) / (1 + 2 * M)) < 0.03, `the lower right, behind, last (${at(far)})`);
    // through its depth: of two points one above the other on the screen, the nearer is reached first
    assert.ok(at(corner(0.5, 0.5, 0.9)) < at(corner(0.5, 0.5, 0.1)), 'the band reaches a near surface before the one behind it');
  }
});

test('Tide comes in with a vortex that lifts and settles in about a second, and its tide rises once a period on the page\'s clock', () => {
  const { vortex, tide, VORTEX, TIDE } = hero;
  assert.equal(TIDE, require('../js/motion.js').TIDE, 'the figure\'s tide keeps time with the page\'s');
  assert.equal(vortex(0), 0);
  assert.equal(vortex(-0.5), 0);
  assert.equal(vortex(VORTEX.rise), 1, 'the dots lift fully into the vortex');
  assert.equal(vortex(VORTEX.rise + VORTEX.settle), 0, 'and settle back in place');
  assert.ok(VORTEX.rise + VORTEX.settle <= 1.2, 'in about a second');
  for (let t = 0.01; t < VORTEX.rise + VORTEX.settle; t += 0.01) {
    const v = vortex(t), w = vortex(t + 0.01);
    assert.ok(v >= 0 && v <= 1);
    if (t + 0.01 <= VORTEX.rise) assert.ok(w >= v, `it only rises until ${VORTEX.rise} s`);
    else if (t >= VORTEX.rise) assert.ok(w <= v, 'then only settles');
  }
  assert.ok(VORTEX.shine > VORTEX.rise && VORTEX.shine < VORTEX.rise + VORTEX.settle, 'its sheen sets off as it settles');
  const at = f => tide(f * TIDE + 7 * TIDE);
  assert.ok(tide(1.3).every((v, i) => Math.abs(v - tide(1.3 + 3 * TIDE)[i]) < 1e-9), 'once every period');
  assert.ok(at(0)[0] < 0 && at(0.75)[0] > 1, 'from just below the base to just above the caduceus');
  for (let f = 0; f < 0.75; f += 0.01) assert.ok(at(f + 0.01)[0] >= at(f)[0], 'rising, never falling back');
  assert.equal(at(0)[1], 0);
  assert.equal(at(0.8)[1], 0, 'and gone for the last quarter of the period');
  assert.ok(Math.max(...Array.from({ length: 100 }, (_, i) => at(i / 100)[1])) <= 0.4, 'a soft light, never more than 0.4');
});

test('the figure lives about its joints: the torso breathes and the head rides on it, the arms follow at half, the wing beats, the key light drifts; at rest nothing moves at all', () => {
  const { life, breathAt, keyLight, staffAxis, LIFE, PART_NAMES } = hero;
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'hero', 'hero.json'), 'utf8'));
  const slot = name => (PART_NAMES.indexOf(name) + 1) * 4;
  const restLight = keyLight(0, 0);
  for (const still of [life(3.7, meta.joints, meta.center, 0), life(3.7, null, meta.center, 1), life(0, meta.joints, meta.center, -1)]) {
    assert.ok(Array.from(still.parts).every(v => v === 0) && Array.from(still.joints).every(v => v === 0), 'at rest every turn, shift, scale, and tilt is exactly zero');
    assert.deepEqual(still.key, restLight, 'and the key light is where it always was');
    assert.equal(still.breath, 0);
  }
  assert.ok(Math.abs(Math.hypot(...restLight) - 1) < 1e-12 && restLight[0] < 0 && restLight[1] > 0 && restLight[2] > 0, 'the key light comes from the upper left, in front');
  // the breath: in for the first 42% of the cycle, out for the rest, between -1 and 1, once every LIFE.breath seconds
  assert.ok(Math.abs(breathAt(0) + 1) < 1e-9 && Math.abs(breathAt(0.42 * LIFE.breath) - 1) < 1e-9, 'a breath goes from all out to all in');
  for (let t = 0; t < LIFE.breath; t += 0.01) {
    const b = breathAt(t), next = breathAt(t + 0.01);
    assert.ok(b >= -1 - 1e-9 && b <= 1 + 1e-9);
    if (t + 0.01 < 0.42 * LIFE.breath) assert.ok(next >= b, 'in'); else if (t > 0.42 * LIFE.breath && t + 0.01 < LIFE.breath) assert.ok(next <= b, 'and out, more slowly');
    assert.ok(Math.abs(breathAt(t + 3 * LIFE.breath) - b) < 1e-9, 'once a period');
  }
  const same = life(11.3, meta.joints, meta.center, 1), again = life(11.3, meta.joints, meta.center, 1);
  assert.deepEqual(same, again, 'deterministic');
  let torsoMax = 0, wingMax = 0, flutterMax = 0, reachMax = 0, tilts = 0, keyDrift = 0, headHigh = 0, headLow = 0;
  for (let t = 0; t < 60; t += 0.05) {
    const m = life(t, meta.joints, meta.center, 1), P = m.parts, J = m.joints;
    const breath = m.breath, scale = J[slot('torso') + 2], neck = meta.joints.head, core = meta.joints.torso;
    assert.ok(Math.abs(scale - 0.005 * breath) < 1e-9, 'the torso scales about the chest with the breath');
    assert.equal(P[slot('torso')], 0, 'and does not turn');
    torsoMax = Math.max(torsoMax, Math.abs(scale));
    // the head rides on the torso: its shift is the torso's displacement at the neck (figure units, y down, so a rise is
    // a positive shift in the shader's y up); the arms, the wing, and the staff follow their shoulders at half
    const lift = -0.0025 * breath, dx = (neck[0] - core[0]) * scale, dy = (neck[1] - core[1]) * scale + lift;
    assert.ok(Math.abs(P[slot('head') + 2] - dx) < 1e-9 && Math.abs(P[slot('head') + 3] + dy) < 1e-9, 'the head rides on the chest');
    if (breath > 0.99) headHigh = P[slot('head') + 3]; if (breath < -0.99) headLow = P[slot('head') + 3];
    for (const name of ['arm', 'caduceus', 'staff', 'wing', 'reach']) {
      const j = meta.joints[name === 'caduceus' || name === 'staff' ? 'arm' : name];
      const ex = (j[0] - core[0]) * scale * 0.5, ey = ((j[1] - core[1]) * scale + lift) * 0.5;
      assert.ok(Math.abs(P[slot(name) + 2] - ex) < 1e-9 && Math.abs(P[slot(name) + 3] + ey) < 1e-9, `${name} follows its shoulder at half`);
    }
    const turnOf = name => Math.atan2(-P[slot(name) + 1], P[slot(name)] + 1);
    wingMax = Math.max(wingMax, Math.abs(turnOf('wing')));
    flutterMax = Math.max(flutterMax, Math.abs(turnOf('caduceus')));
    reachMax = Math.max(reachMax, Math.abs(turnOf('reach')));
    assert.equal(turnOf('staff'), 0, 'the staff never turns: the snakes move in the shader');
    assert.equal(turnOf('head'), 0, 'the head never turns');
    assert.ok(Math.abs(J[slot('wing') + 3] - 0.6 * turnOf('wing')) < 1e-6, 'the wing tilts in depth as it turns');
    tilts += Math.abs(J[slot('wing') + 3]) > 0 ? 1 : 0;
    for (let i = 0; i < 4; i++) assert.equal(P[slot('base') + i], 0, 'the clouds hold their place');
    for (const name of PART_NAMES) {
      const j = meta.joints[name] || meta.center;
      assert.ok(Math.abs(J[slot(name)] - (j[0] - meta.center[0])) < 1e-6 && Math.abs(J[slot(name) + 1] - (meta.center[1] - j[1])) < 1e-6, `${name}'s joint, about the pivot, y up`);
    }
    assert.ok(Math.abs(Math.hypot(...m.key) - 1) < 1e-6, 'the key light stays a unit vector');
    keyDrift = Math.max(keyDrift, Math.acos(Math.min(1, m.key[0] * restLight[0] + m.key[1] * restLight[1] + m.key[2] * restLight[2])));
  }
  assert.ok(torsoMax > 0.004 && torsoMax <= 0.005 + 1e-9, `the breath scales the torso by up to half a percent (${torsoMax})`);
  assert.ok(headHigh > 0 && headLow < 0, 'the head rises with a breath in and falls with a breath out');
  assert.ok(wingMax > 0.025 && wingMax <= 0.03 + 1e-9, `the wing beats by up to 1.7 degrees (${wingMax})`);
  assert.ok(flutterMax > 0.009 && flutterMax <= 0.0105 + 1e-9, `the caduceus's wings beat by up to 0.6 degrees (${flutterMax})`);
  assert.ok(reachMax > 0.003 && reachMax <= 0.004 + 1e-9, `the outstretched arm turns by a hair (${reachMax})`);
  assert.ok(tilts > 0);
  assert.ok(keyDrift > 0.05 && keyDrift < 0.09, `the key light drifts by a few degrees (${(keyDrift * 180 / Math.PI).toFixed(1)})`);
  // the ease scales everything down to rest
  const half = life(11.3, meta.joints, meta.center, 0.5), full = life(11.3, meta.joints, meta.center, 1);
  assert.ok(Math.abs(half.joints[slot('torso') + 2] - 0.5 * full.joints[slot('torso') + 2]) < 1e-9);
  // the staff's axis runs from the top of the caduceus down to the staff's foot, leaning a little
  const axis = staffAxis(meta.joints);
  assert.deepEqual(axis.slice(0, 2), meta.joints.caduceus);
  assert.ok(Math.abs(axis[2] - (meta.joints.staff[0] - meta.joints.caduceus[0]) / (meta.joints.staff[1] - meta.joints.caduceus[1])) < 1e-12);
  assert.deepEqual(staffAxis(null), [0, 0, 0]);
});

test('the shipped joints sit on the figure, one for every part of the statue, and the parts are in the order the shader knows', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'hero', 'hero.json'), 'utf8'));
  assert.deepEqual(meta.parts, hero.PART_NAMES.slice(0, -1), 'the shader picks the caduceus, the head, and the staff by their numbers');
  for (const name of ['wing', 'caduceus', 'arm', 'head', 'torso', 'reach', 'staff']) {
    const j = meta.joints[name];
    assert.ok(Array.isArray(j) && j.length === 2, `${name} has a joint`);
    assert.ok(j[0] > meta.bounds[0] && j[0] < meta.bounds[2] && j[1] > meta.bounds[1] && j[1] < meta.bounds[3], `${name}'s joint lies within the statue's bounds`);
  }
  assert.deepEqual(meta.joints.torso, meta.core, 'the breath is centred on the chest');
  assert.ok(meta.joints.caduceus[1] < hero.STAFF_FROM && meta.joints.staff[1] > hero.STAFF_FROM, 'the caduceus splits into its wings above the fist and the staff below');
  assert.ok(Object.keys(meta.joints).every(name => hero.PART_NAMES.indexOf(name) >= 0), 'every joint names a part');
});

test('each point of the outline knows which part it belongs to', () => {
  const size = 48, rgba = new Uint8ClampedArray(size * size * 4), parts = ['near', 'far', 'base'];
  const paint = (test, part, depth) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (test(x, y)) { const i = (y * size + x) * 4; rgba[i] = depth; rgba[i + 2] = part * 32; } };
  paint((x, y) => x >= 8 && x <= 30 && y >= 8 && y <= 30, 2, 120);
  paint((x, y) => Math.hypot(x - 30, y - 20) <= 8, 1, 200);
  const lines = hero.edges(rgba, size, parts, [['near', 'far']], 1.2, 0.5);
  assert.equal(lines.parts.length, lines.points.length / 3, 'one part per point');
  for (let i = 0; i < lines.parts.length; i++) {
    const x = lines.points[i * 3] * (size - 1), y = lines.points[i * 3 + 1] * (size - 1), onDisc = Math.abs(Math.hypot(x - 30, y - 20) - 8) < 0.6;
    assert.equal(lines.parts[i], onDisc ? 1 : 2, `the point at ${x.toFixed(1)}, ${y.toFixed(1)} belongs to the ${onDisc ? 'disc' : 'square'}`);
  }
});

test('the shipped hero data matches what the engine expects', () => {
  const dir = path.join(__dirname, '..', 'assets', 'hero');
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'hero.json'), 'utf8'));
  const [x0, y0, x1, y1] = meta.bounds;
  assert.ok(x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && x1 > x0 && y1 > y0);
  assert.ok(meta.density > 0 && meta.density <= 1);
  assert.ok(meta.ring.r > 0 && meta.ring.r < 0.5);
  // the data maps are lossless WebP (VP8L) with no color profile, so browsers hand the engine the exact bytes
  const lossless = file => {
    const webp = fs.readFileSync(path.join(dir, file));
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF', file);
    assert.equal(webp.toString('ascii', 8, 16), 'WEBPVP8L', `${file} must be a simple lossless WebP, with no ICC profile to color-manage the data`);
    assert.equal(webp[20], 0x2f);
    const bits = webp.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  };
  assert.deepEqual(lossless('ink.webp'), [meta.size, meta.size]);
  assert.deepEqual(lossless('light.webp'), [meta.size, meta.size]);
  assert.deepEqual(lossless('depth.webp'), [meta.depth, meta.depth]);
  assert.ok(meta.size >= 896, `the ink map is ${meta.size} px`);
  // The budget holds per paper: a page loads only the dots' map for the paper it opens on (the ink map on light
  // paper, the light map on dark; dotMap) and fetches the other only when the paper changes.
  for (const [paper, map] of [['light', 'ink.webp'], ['dark', 'light.webp']]) {
    const total = [map, 'depth.webp', 'bluenoise.png', 'hero.json', 'color.webp'].reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
    assert.ok(total < 200 * 1024, `hero data on ${paper} paper is ${total} bytes`);
  }
  // each map has its still, which covers the figure until it is drawn, and a 512 px preview of it
  for (const still of ['still', 'still-dark', 'preview', 'preview-dark']) assert.ok(fs.statSync(path.join(dir, `${still}.webp`)).size > 1000, still);
  const webp = fs.readFileSync(path.join(dir, 'color.webp'));
  assert.equal(webp.toString('ascii', 0, 4), 'RIFF');
  assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
});

test('normals follow the depth map: flat ground faces the viewer, slopes tilt away from the rise, edges are one-sided', () => {
  const size = 16, rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    rgba[i] = y >= 14 ? 0 : x < 8 ? 128 : Math.min(255, 128 + (x - 7) * 30);  // flat on the left, rising to the right; the last two rows are outside the figure
  }
  const field = hero.reliefField(rgba, size, 0);
  assert.equal(field[15 * size + 3], -1, 'outside the figure');
  assert.ok(Math.abs(field[6 * size + 3] - 128 / 255) < 1e-6);
  const at = (x, y) => new Float32Array([x / (size - 1), y / (size - 1), 1]);
  const flat = hero.depthNormals(field, size, at(3, 6), 3, 0.34);
  assert.deepEqual(Array.from(flat.subarray(0, 2)).map(Math.abs), [0, 0]);
  assert.ok(Math.abs(flat[2] - 128 / 255) < 1e-6, 'each dot gets the depth under it');
  const slope = hero.depthNormals(field, size, at(11, 6), 3, 0.34);
  assert.ok(slope[0] < -0.3, `a surface rising to the right tilts left, got nx ${slope[0]}`);
  assert.ok(Math.abs(slope[1]) < 1e-6, 'no tilt along y on a pure x ramp');
  assert.ok(Math.hypot(slope[0], slope[1]) <= 0.94 + 1e-6, 'tilt stays under the limit so nz is never zero');
  const edge = hero.depthNormals(field, size, at(11, 13), 3, 0.34);
  assert.ok(Math.abs(edge[0] - slope[0]) < 1e-6, 'the row above the figure\'s edge still gets its x slope from a one-sided y sample');
  const rim = hero.depthNormals(field, size, new Float32Array([3 / 15, 13.6 / 15, 1]), 3, 0.34);
  assert.ok(Math.abs(rim[2] - 128 / 255) < 1e-6, 'a dot on the edge takes its depth from the figure, never from the empty pixels beside it');
  const many = hero.depthNormals(field, size, hero.stipple(rgba.map((v, i) => i % 4 === 1 ? 255 : v), size, Uint8Array.from({ length: 16 }, (_, i) => i * 16), 4, 24, 1, 0), 3, 0.34);
  assert.equal(many.length % 3, 0);
  for (let i = 0; i < many.length; i += 3) assert.ok(many[i] * many[i] + many[i + 1] * many[i + 1] < 1, 'every normal has a positive z');
});

test('smoothing the depth inside the figure removes the 8-bit terraces from the normals, and never pulls in the sky', () => {
  // a gentle ramp, one level every 3 px, then the sky; 128 px with the relief scaled up 3.5x behaves like the 448 px map
  const size = 128, relief = 0.34 * 447 / 127, rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) rgba[(y * size + x) * 4] = x < 96 ? Math.round(100 + x / 3) : 0;
  const row = field => Array.from({ length: 60 }, (_, k) => hero.depthNormals(field, size, new Float32Array([(16 + k) / 127, 0.5, 1]), 3, relief)[0]);
  const spread = list => { const m = list.reduce((a, b) => a + b, 0) / list.length; return Math.sqrt(list.reduce((a, b) => a + (b - m) ** 2, 0) / list.length); };
  const raw = row(hero.reliefField(rgba, size, 0)), smooth = row(hero.reliefField(rgba, size, 1.5));
  assert.ok(spread(raw) > 0.02, `the raw 8-bit ramp terraces (spread ${spread(raw)})`);
  assert.ok(spread(smooth) < spread(raw) / 4, `smoothed normals are steady (spread ${spread(smooth)} vs ${spread(raw)})`);
  const field = hero.reliefField(rgba, size, 1.5);
  assert.ok(Math.abs(field[64 * size + 95] - (100 + 95 / 3) / 255) < 0.01, 'the last pixel before the sky keeps its depth');
  assert.equal(field[64 * size + 96], -1);
});

test('each dot samples the avatar color map bilinearly, sparkle included', () => {
  const size = 4, rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    rgba[i] = x < 2 ? 200 : 40;        // red on the left half
    rgba[i + 1] = 90;
    rgba[i + 2] = y < 2 ? 30 : 230;    // blue on the lower half
    rgba[i + 3] = x === 3 && y === 3 ? 255 : 0;  // one sparkle in the corner
  }
  const at = (x, y) => [x / (size - 1), y / (size - 1), 0, 1];
  const out = hero.sampleColors(rgba, size, new Float32Array([...at(0, 0), ...at(3, 3), ...at(1.5, 0), ...at(3, 2.5)]), 4);
  assert.deepEqual(Array.from(out.subarray(0, 4)), [200, 90, 30, 0]);
  assert.deepEqual(Array.from(out.subarray(4, 8)), [40, 90, 230, 255]);
  assert.deepEqual(Array.from(out.subarray(8, 12)), [120, 90, 30, 0], 'halfway between red and not-red');
  assert.deepEqual(Array.from(out.subarray(12, 16)), [40, 90, 230, 127], 'halfway into the sparkle');
  assert.equal(out.length, 16);
});

test('a dot takes the material at the nearest pixel, never a blend of two, and Gear Two keeps 40% of the colors', () => {
  const size = 4, rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) rgba[(y * size + x) * 4] = x < 2 ? 0 : 204;  // gold on the left, glint on the right
  assert.equal(hero.materialAt(rgba, size, 0, 0), 0);
  assert.equal(hero.materialAt(rgba, size, 1, 1), 204);
  for (const u of [0.45, 0.5, 0.55]) assert.ok([0, 204].includes(hero.materialAt(rgba, size, u, 0.5)), `material at u = ${u}`);
  assert.equal(hero.sampleColors(rgba, size, new Float32Array([0.5, 0.5, 0]), 3)[0], 102, 'bilinear sampling would invent cloud between gold and glint');
  assert.equal(hero.materialAt(rgba, size, -1, 2), 0, 'points off the map clamp to its edge');
  assert.equal(hero.tintFor({ gear: false }), 1);
  assert.equal(hero.tintFor({ gear: true }), 0.4);
});

test('the dots are ink on light paper and light on dark paper, Gear Two\'s included', () => {
  assert.equal(hero.dotMap({ dark: false, gear: false }), 'ink');
  assert.equal(hero.dotMap({ dark: true, gear: false }), 'light');
  assert.equal(hero.dotMap({ dark: true, gear: true }), 'light');
});

test('glitch tiles are deterministic per frame, land inside the box on the figure, and jump sideways', () => {
  const box = { x: 100, y: 50, size: 400 };
  const a = hero.glitchTiles(7, box, 3), b = hero.glitchTiles(7, box, 3);
  assert.deepEqual(a, b);
  const frames = Array.from({ length: 48 }, (_, f) => hero.glitchTiles(f, box, 3));
  assert.ok(frames.some(t => t.length > 0) && frames.some(t => t.length < 3), 'the number of tiles varies between frames');
  assert.ok(frames.some((t, i) => i && JSON.stringify(t) !== JSON.stringify(frames[i - 1])), 'tiles change from frame to frame');
  for (const [x, y, w, h, dx, dy] of frames.flat()) {
    assert.ok(x >= box.x && x + w <= box.x + box.size && y >= box.y && y + h <= box.y + box.size, 'inside the box');
    assert.ok(w >= box.size * 0.08 && w <= box.size * 0.2 && h >= box.size * 0.035 && h <= box.size * 0.105, `size ${w}×${h}`);
    assert.ok(Math.abs(dx) >= box.size * 0.025 && Math.abs(dx) <= box.size * 0.085, `sideways jump ${dx}`);
    assert.ok(Math.abs(dy) <= box.size * 0.008, `vertical drift ${dy}`);
  }
  const rightHalf = (x) => x > box.x + box.size / 2;
  const onFigure = hero.glitchTiles(7, box, 3, rightHalf).concat(hero.glitchTiles(8, box, 3, rightHalf), hero.glitchTiles(9, box, 3, rightHalf));
  assert.ok(onFigure.length > 0);
  for (const [x, , w] of onFigure) assert.ok(rightHalf(x + w / 2), 'a tile centre misses the figure');
  assert.deepEqual(hero.glitchTiles(7, box, 3, () => false), []);
});

test('the opening holds still in ink, shines, turns once and returns, goes to Gear Two and back, then hands over', () => {
  const { INTRO } = hero;
  // frames at 60 fps; the page answers "red" by switching Gear Two on 90 ms later and "back" by switching it off 300 ms later
  let state = { stage: 'hold', at: 0, redAt: null }, clock = 0, gear = false, switchAt = null, target = null;
  const stages = [], acts = [];
  for (let f = 0; f < 60 * 30 && state; f++) {
    const now = f / 60;
    if (switchAt !== null && now >= switchAt) { gear = target; switchAt = null; }
    const step = hero.introStep(state, now, clock, gear);
    if (step.act) acts.push([step.act, now, step.clock]);
    if (step.act === 'red') { switchAt = now + 0.09; target = true; }
    if (step.act === 'back') { switchAt = now + 0.3; target = false; }
    if (!step.state || step.state.stage !== state.stage) stages.push([step.state ? step.state.stage : 'done', now]);
    clock = step.clock;
    state = step.state;
    if (state) clock += ({ hold: 0, shine: 0, turn: INTRO.rate, red: 0, redshine: 0, redturn: INTRO.redRate, back: 0 })[state.stage] / 60;
  }
  assert.equal(state, null, 'the opening ends');
  assert.deepEqual(stages.map(s => s[0]), ['shine', 'turn', 'red', 'redshine', 'redturn', 'back', 'done']);
  assert.deepEqual(acts.map(a => a[0]), ['shine', 'ring', 'red', 'redshine', 'back']);
  const at = name => acts.find(a => a[0] === name);
  assert.equal(INTRO.hold, 2, 'the still figure holds for two seconds before anything moves');
  assert.ok(Math.abs(at('shine')[1] - INTRO.hold) < 1 / 60 + 1e-9, 'the figure holds still for INTRO.hold');
  assert.ok(Math.abs(at('ring')[1] - at('shine')[1] - INTRO.sweep) < 1 / 60 + 1e-9, 'the ring arrives once the shine has crossed');
  assert.equal(at('red')[2], 7, 'Gear Two comes when the figure has turned once and is back in the middle');
  assert.ok(Math.abs(at('red')[1] - at('ring')[1] - 7 / INTRO.rate) < 0.05, 'the turn runs at INTRO.rate');
  assert.ok(Math.abs(at('redshine')[1] - at('red')[1] - 0.09 - INTRO.red) < 0.03, 'the red shine waits INTRO.red after the switch');
  assert.equal(at('back')[2], 14, 'the page comes back when the red figure has turned once the other way');
  assert.ok(stages.at(-1)[1] - at('back')[1] >= 0.3 - 1e-9, 'it hands over only once Gear Two is off');

  // from Gear Two the opening turns once and hands over without switching anything
  state = { stage: 'turn', at: 0, redAt: null };
  const done = hero.introStep(state, 3, 7, true);
  assert.equal(done.state, null);
  assert.equal(done.act, null);
  // a page that never switches is not waited on for longer than INTRO.wait
  state = { stage: 'red', at: 0, redAt: null };
  assert.equal(hero.introStep(state, INTRO.wait - 0.01, 7, false).state.stage, 'red');
  assert.equal(hero.introStep(state, INTRO.wait + 0.01, 7, false).state, null);
});

test('on screens with the pixels for it the whole figure is stippled on a grid twice as fine, in the same tone', () => {
  // a 16 x 16 tile holding every threshold once, shuffled, so each grid keeps exactly its share of cells
  const size = 16, noise = Uint8Array.from(Array.from({ length: 256 }, (_, i) => i).sort((a, b) => hero.hash(a + 77) - hero.hash(b + 77)));
  const map = ink => { const rgba = new Uint8ClampedArray(size * size * 4); for (let i = 0; i < size * size; i++) rgba[i * 4 + 1] = ink; return rgba; };
  const cells = pts => Array.from({ length: pts.length / 3 }, (_, i) => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]);
  const pale = map(51), plain = cells(hero.stipple(pale, size, noise, 16, 40, 0.6, 0)), fine = cells(hero.stipple(pale, size, noise, 16, 40, 0.6, 0, true));
  for (const [x, y] of fine) {
    assert.ok(Math.abs(x * 80 - Math.floor(x * 80) - 0.5) < 1e-4 && Math.abs(y * 80 - Math.floor(y * 80) - 0.5) < 1e-4, 'fine dots sit on the cells of a grid twice as fine');
  }
  assert.ok(fine.length > plain.length * 2.2 && fine.length < plain.length * 3, `about 2.6 dots where there was one (${fine.length} vs ${plain.length})`);
  // the vertex shader draws a dot mix(1, 0.62, scale) its size: where the dots stand apart, the fine ones cover the paper the coarse ones did
  const cover = (dots, split) => dots.reduce((sum, [, , ink]) => sum + (1 - 0.38 * hero.fineScale(split, ink)) ** 2, 0);
  const ratio = cover(fine, true) / cover(plain, false);
  assert.ok(ratio > 0.85 && ratio < 1.15, `the same tone where the ink is pale (${ratio.toFixed(2)})`);
  assert.equal(hero.fineScale(false, 0.7), 0, 'the coarse grid draws full-size dots');
  assert.equal(hero.fineScale(true, 0), 1, 'a pale fine dot is 62% the size');
  for (let ink = 0.1; ink <= 1; ink += 0.1) {
    assert.ok(hero.fineScale(true, ink) < hero.fineScale(true, ink - 0.1), 'a fine dot grows with its ink, so a fine shadow stays solid');
    assert.ok(hero.fineScale(true, ink) > 0, 'and never past a coarse dot');
  }
  const dense = map(255);
  assert.deepEqual(Array.from(hero.stipple(dense, size, noise, 16, 40, 0.6, 0.7, true)), Array.from(hero.stipple(dense, size, noise, 16, 40, 0.6, 0.7, true)), 'deterministic');
});

test('stippling skips only the paper beside the figure: every cell it skips would have kept no dot', () => {
  // islands of ink in an empty map, read by a straightforward stippler that visits every cell
  const size = 37, rgba = new Uint8ClampedArray(size * size * 4), noise = Uint8Array.from({ length: 64 }, (_, i) => hero.hash(i) * 255);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const island = (x > 3 && x < 11 && y > 5 && y < 30) || Math.hypot(x - 25, y - 12) < 6 || (x === 33 && y === 33);
    rgba[(y * size + x) * 4 + 1] = island ? Math.round(255 * hero.hash(y * size + x + 9)) : 0;
  }
  const every = (res, density, jitter, fine) => {
    const n = fine ? res * 2 : res, kept = density * (fine ? 1 / (4 * 0.62 * 0.62) : 1), last = size - 1, scale = last / n, out = [];
    for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
      const v = (gy + 0.5) * scale, u = (gx + 0.5) * scale, i0 = Math.floor(v), j0 = Math.floor(u), fy = v - i0, fx = u - j0;
      const i1 = Math.min(i0 + 1, last), j1 = Math.min(j0 + 1, last), at = (i, j) => rgba[(i * size + j) * 4 + 1];
      const ink = (at(i0, j0) * (1 - fx) * (1 - fy) + at(i0, j1) * fx * (1 - fy) + at(i1, j0) * (1 - fx) * fy + at(i1, j1) * fx * fy) / 255;
      if (ink <= 0 || ink * kept <= noise[(gy % 8) * 8 + (gx % 8)] / 255) continue;
      const k = gy * n + gx;
      out.push((gx + 0.5 + (hero.hash(k * 2 + 1) - 0.5) * jitter) / n, (gy + 0.5 + (hero.hash(k * 2 + 2) - 0.5) * jitter) / n, ink);
    }
    return Array.from(new Float32Array(out));
  };
  for (const [res, fine] of [[29, false], [64, false], [29, true], [53, true]]) {
    const dots = Array.from(hero.stipple(rgba, size, noise, 8, res, 0.85, 0.7, fine));
    assert.ok(dots.length > 30, `the islands are stippled at ${res}${fine ? ', fine' : ''}`);
    assert.deepEqual(dots, every(res, 0.85, 0.7, fine), `the same dots as visiting every cell at ${res}${fine ? ', fine' : ''}`);
  }
});

test('the avatar\'s star glints are its round sparkles off the marble, strongest first', () => {
  const size = 40, color = new Uint8ClampedArray(size * size * 4), relief = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    relief[i] = x < 25 ? 200 : 0;                     // the figure covers x < 25
    color[i] = x < 10 ? 51 : 0;                       // marble on the left, gold beyond
    color[i + 3] = 128;                               // no sparkle
  }
  const spot = (cx, cy, v, sx = 1.2, sy = 1.2) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, s = v * Math.exp(-((x - cx) ** 2) / (2 * sx * sx) - ((y - cy) ** 2) / (2 * sy * sy));
      color[i + 3] = Math.max(color[i + 3], 128 + Math.round(s * 127));
    }
  };
  spot(20, 10, 1);                 // a round glint on gold
  spot(15, 25, 0.6);               // a fainter one
  spot(5, 20, 1);                  // a glint on marble: a highlight on the skin, not a star
  spot(17, 33, 1, 6, 0.8);         // a long highlight along an edge, not a star
  spot(30, 20, 0.8);               // just outside the figure, in the sky
  spot(37, 3, 0.8);                // too far from the figure
  const found = hero.glints(color, relief, size, 10);
  const at = Array.from({ length: found.length / 3 }, (_, i) => [Math.round(found[i * 3] * 39), Math.round(found[i * 3 + 1] * 39), found[i * 3 + 2]]);
  assert.deepEqual(at.map(([x, y]) => [x, y]), [[20, 10], [30, 20], [15, 25]], 'round glints on gold and just outside, strongest first');
  assert.ok(at[0][2] > 0.95 && at[2][2] < 0.7, 'each with its strength');
  assert.equal(hero.glints(color, relief, size, 1).length, 3, 'at most `limit`');
  // the head's and the hands' ellipses (figure units) keep their highlights from being taken for stars
  const kept = hero.glints(color, relief, size, 10, [[20 / 39, 10 / 39, 0.06, 0.06, 0], [15 / 39, 25 / 39, 0.05, 0.08, 0.3]]);
  assert.deepEqual(Array.from({ length: kept.length / 3 }, (_, i) => [Math.round(kept[i * 3] * 39), Math.round(kept[i * 3 + 1] * 39)]), [[30, 20]], 'none in the hair or on a hand');
  assert.equal(hero.withinZones([[0.5, 0.5, 0.2, 0.1, Math.PI / 2]], 0.5, 0.68), true, 'a turned ellipse is long across its turn');
  assert.equal(hero.withinZones([[0.5, 0.5, 0.2, 0.1, Math.PI / 2]], 0.68, 0.5), false);
  assert.equal(hero.withinZones(undefined, 0.5, 0.5), false);
});

test('the stars of the sky are read from the depth map\'s blue, each with its strength', () => {
  const size = 20, rgba = new Uint8ClampedArray(size * size * 4);
  rgba[(3 * size + 4) * 4 + 2] = 255;     // a strong star at (4, 3)
  rgba[(12 * size + 17) * 4 + 2] = 128;   // a fainter one at (17, 12)
  rgba[(9 * size + 9) * 4] = 200;         // depth alone is not a star
  const found = Array.from(hero.skyStars(rgba, size));
  assert.deepEqual(found.map(v => Math.round(v * 1000) / 1000), [4 / 19, 3 / 19, 1, 17 / 19, 12 / 19, 127 / 254].map(v => Math.round(v * 1000) / 1000));
  assert.equal(hero.skyStars(new Uint8ClampedArray(size * size * 4), size).length, 0, 'an empty sky has none');
});

test('the stars of the sky are read only outside the figure, where the blue does not name a part', () => {
  const size = 20, rgba = new Uint8ClampedArray(size * size * 4);
  rgba[(3 * size + 4) * 4 + 2] = 255;                                    // a star at (4, 3)
  rgba[(9 * size + 9) * 4] = 200; rgba[(9 * size + 9) * 4 + 2] = 64;     // inside the figure: part 2, not a star
  assert.equal(hero.skyStars(rgba, size).length, 3);
});

test('the statue is outlined: each part traced at its edge, evenly, where the sky or a part it lies in front of is beyond', () => {
  const size = 64, rgba = new Uint8ClampedArray(size * size * 4), parts = ['near', 'far', 'base'];
  const paint = (test, part, depth) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (test(x, y)) { const i = (y * size + x) * 4; rgba[i] = depth; rgba[i + 2] = part * 32; } };
  // a far square, a near disc over part of it, and a base below; and around the disc's top a fringe (half a step less)
  paint((x, y) => x >= 10 && x <= 40 && y >= 10 && y <= 40, 2, 120);
  paint((x, y) => Math.hypot(x - 40, y - 25) <= 10, 1, 200);
  paint((x, y) => y >= 46 && y <= 60 && x >= 8 && x <= 56, 3, 150);
  for (let x = 30; x <= 50; x++) { const i = (14 * size + x) * 4; if (rgba[i + 2] === 32) { rgba[i + 2] = 16; } }
  const lines = hero.edges(rgba, size, parts, [['near', 'far']], 1.2, 0.5), pts = [];
  for (let i = 0; i < lines.points.length; i += 3) pts.push([lines.points[i] * (size - 1), lines.points[i + 1] * (size - 1), lines.points[i + 2]]);
  const onDisc = pts.filter(([x, y]) => Math.abs(Math.hypot(x - 40, y - 25) - 10) < 1.6);
  const onSquare = pts.filter(([x, y]) => Math.min(Math.abs(x - 10), Math.abs(x - 40), Math.abs(y - 10), Math.abs(y - 40)) < 1.2 && Math.hypot(x - 40, y - 25) > 11.5);
  assert.ok(onDisc.length + onSquare.length === pts.length, 'every point is on the disc\'s edge or the square\'s');
  // the disc's whole edge is drawn, over the square and against the sky, but where its fringe is the edge comes in
  const around = new Set(onDisc.map(([x, y]) => Math.round(Math.atan2(y - 25, x - 40) * 8 / Math.PI)));
  assert.ok(around.size >= 15, `the near part's edge goes all the way round (${around.size} of 16 sectors)`);
  // the far square's edge is drawn against the sky, not where the near disc covers it, and the base has none
  assert.ok(onSquare.every(([x, y]) => !(x > 38 && y > 15 && y < 35)), 'no edge of the far part behind the near one');
  assert.ok(onSquare.some(([x]) => x < 11), 'the far part\'s own edge against the sky');
  assert.ok(pts.every(([, y]) => y < 45), 'the base keeps its soft fade');
  // evenly spaced, and facing out
  const left = onSquare.filter(([x, y]) => x < 11 && y > 15 && y < 35).sort((a, b) => a[1] - b[1]);
  const gaps = left.slice(1).map((p, i) => p[1] - left[i][1]);
  assert.ok(gaps.every(g => g > 0.2 && g < 0.8), `points along an edge every half pixel or so (${Math.min(...gaps).toFixed(2)}-${Math.max(...gaps).toFixed(2)})`);
  assert.ok(left.every(([, , out]) => Math.abs(out - 0.5) < 0.05), 'and out of the left side is to the left');
  // the field whose half level the outline is: the statue's parts, blurred, not the base
  assert.ok(lines.field[25 * size + 20] > 0.9 && lines.field[53 * size + 30] === 0 && lines.field[2 * size + 2] === 0);
  assert.equal(hero.edges(new Uint8ClampedArray(size * size * 4), size, parts, [], 1.2, 0.5).points.length, 0, 'no figure, no outline');
});

test('the wing and the caduceus are stippled in strokes along their feathers, in the same tone', () => {
  // a dot map of diagonal stripes (the feathers, running down to the right) over a part named "wing", in the depth map
  const big = 96, small = 48, map = new Uint8ClampedArray(big * big * 4), depth = new Uint8ClampedArray(small * small * 4);
  for (let y = 0; y < big; y++) for (let x = 0; x < big; x++) map[(y * big + x) * 4 + 1] = 120 + 100 * Math.sin((x - y) * 0.6);
  for (let y = 8; y < 40; y++) for (let x = 8; x < 40; x++) { depth[(y * small + x) * 4] = 200; depth[(y * small + x) * 4 + 2] = 32; }
  const field = hero.strokes(map, big, depth, small, ['wing', 'torso'], ['wing'], 2);
  const at = (x, y) => field.angle[y * small + x];
  assert.ok(Math.abs(Math.cos(at(24, 24) - Math.PI / 4)) > 0.98, `along the stripes (${at(24, 24)})`);
  assert.ok(Number.isNaN(at(2, 2)), 'nowhere outside the plumed parts');
  assert.ok(Number.isNaN(hero.strokes(map, big, depth, small, ['torso', 'wing'], ['wing'], 2).angle[24 * small + 24]), 'only in the parts named');
  // stippled in strokes: the same number of dots within a few percent, lined up in threes along the direction
  const noise = Uint8Array.from({ length: 256 }, (_, i) => Math.floor(((i * 97) % 256)));
  const plain = hero.stipple(map, big, noise, 16, 60, 0.85, 0), lined = hero.stipple(map, big, noise, 16, 60, 0.85, 0, false, field);
  assert.ok(Math.abs(lined.length / plain.length - 1) < 0.12, `the tone holds (${lined.length / 3} dots in strokes, ${plain.length / 3} without)`);
  // inside the wing a stroke's dots follow each other a cell apart along the feathers: two of every three steps
  let steps = 0, along = 0;
  for (let i = 0; i + 1 < lined.length / 3; i++) {
    const x = lined[i * 3], y = lined[i * 3 + 1];
    if (!(x > 0.3 && y > 0.3 && x < 0.7 && y < 0.7)) continue;
    const dx = (lined[i * 3 + 3] - x) * 60, dy = (lined[i * 3 + 4] - y) * 60;
    steps++;
    if (Math.abs(Math.hypot(dx, dy) - 1) < 1e-3 && Math.abs(Math.cos(Math.atan2(dy, dx) - Math.PI / 4)) > 0.98) along++;
  }
  assert.ok(along / steps > 0.55, `a stroke\'s dots a cell apart along the feathers (${along} of ${steps} steps)`);
  assert.deepEqual(Array.from(hero.stipple(map, big, noise, 16, 60, 0.85, 0.7, false, field)), Array.from(hero.stipple(map, big, noise, 16, 60, 0.85, 0.7, false, field)), 'deterministic');
});

test('each pixel of the figure knows how far its outline is and which way is out', () => {
  const size = 11, rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 2; y <= 8; y++) for (let x = 2; x <= 8; x++) rgba[(y * size + x) * 4] = 200;   // a square, from 2 to 8
  const field = hero.outlineField(rgba, size);
  const at = (x, y) => [field[(y * size + x) * 2], field[(y * size + x) * 2 + 1]];
  assert.deepEqual(at(0, 0), [0, 0], 'outside the figure');
  assert.deepEqual(at(2, 5), [1, 0.5], 'one pixel in from the left side, out is to the left');
  assert.deepEqual(at(8, 5), [1, 0], 'and from the right side, to the right');
  assert.deepEqual(at(5, 8), [1, 0.25], 'from the bottom, down (y down)');
  assert.equal(at(5, 5)[0], 4, 'the middle is four pixels from every side');
  for (let y = 2; y <= 8; y++) for (let x = 2; x <= 8; x++) {
    const exact = Math.min(x - 1, 9 - x, y - 1, 9 - y);
    assert.ok(Math.abs(at(x, y)[0] - exact) < 1e-9, `distance at ${x},${y}: ${at(x, y)[0]} vs ${exact}`);
  }
});

