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

test('the face and the hands are stippled on a grid twice as fine, fading in over the rim of each zone', () => {
  const zones = [[0.5, 0.5, 0.2, 0.1, 0], [0.2, 0.8, 0.1, 0.05, Math.PI / 2]];
  assert.equal(hero.fineWeight(zones, 0.5, 0.5), 1);
  assert.equal(hero.fineWeight(zones, 0.5, 0.65), 0, 'outside the ellipse');
  const rim = hero.fineWeight(zones, 0.5 + 0.2 * 0.85, 0.5);
  assert.ok(rim > 0 && rim < 1, `the rim fades (${rim})`);
  assert.equal(hero.fineWeight(zones, 0.2, 0.8 + 0.06), 1, 'a turned ellipse is long across its turn');
  assert.equal(hero.fineWeight(zones, 0.2 + 0.09, 0.8), 0);
  assert.equal(hero.fineWeight(null, 0.5, 0.5), 0);

  const size = 16, rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  const noise = Uint8Array.from({ length: 16 }, (_, i) => i * 16);
  const plain = hero.stipple(rgba, size, noise, 4, 40, 0.6, 0);
  const fine = hero.stipple(rgba, size, noise, 4, 40, 0.6, 0, zones);
  const cells = pts => Array.from({ length: pts.length / 3 }, (_, i) => [pts[i * 3], pts[i * 3 + 1]]);
  const inZone = ([x, y]) => hero.fineCell(zones, 40, Math.floor(x * 40), Math.floor(y * 40));
  const outside = cells(fine).filter(p => !inZone(p));
  assert.deepEqual(outside, cells(plain).filter(p => !inZone(p)), 'outside the zones nothing changes');
  const inside = cells(fine).filter(inZone), before = cells(plain).filter(inZone);
  assert.ok(inside.length > before.length * 3, `about four dots where there was one (${inside.length} vs ${before.length})`);
  for (const [x, y] of inside) {
    assert.ok(Math.abs(x * 80 - Math.floor(x * 80) - 0.5) < 1e-4 && Math.abs(y * 80 - Math.floor(y * 80) - 0.5) < 1e-4, 'fine dots sit on the cells of a grid twice as fine');
  }
  assert.deepEqual(Array.from(fine), Array.from(hero.stipple(rgba, size, noise, 4, 40, 0.6, 0, zones)), 'deterministic');
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

