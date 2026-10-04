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

test('about 1.5% of dots are blinked off at any moment, and blinks are short', () => {
  let off = 0, total = 0;
  for (let id = 0; id < 2000; id++) for (let k = 0; k < 40; k++) { total++; if (hero.blinkOff(id, k * 0.37, 1)) off++; }
  const share = off / total;
  assert.ok(share > 0.008 && share < 0.025, `share ${share}`);
  let doubled = 0;
  for (let id = 0; id < 2000; id++) for (let k = 0; k < 40; k++) if (hero.blinkOff(id, k * 0.37, 2)) doubled++;
  assert.ok(doubled / total > share * 1.5, 'Gear Two blinks more often');
  let longest = 0;
  for (let id = 0; id < 300; id++) {
    let run = 0;
    for (let t = 0; t < 30; t += 0.01) { run = hero.blinkOff(id, t, 1) ? run + 0.01 : 0; longest = Math.max(longest, run); }
  }
  assert.ok(longest <= 0.25 + 0.02, `longest blink ${longest}`);
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
  assert.equal(pts.length % 4, 0);
  assert.ok(pts.length > 0);
  // ink is 1 in map columns 0-3 and 0 from column 4; bilinear sampling fades it out by u = 4 of 7
  for (let i = 0; i < pts.length; i += 4) {
    assert.ok(pts[i] * 7 < 4 + 1e-6, `dot at x=${pts[i]} lies where the ink is zero`);
    assert.ok(Math.abs(pts[i + 2] - 200 / 255) < 1e-6);
  }
  assert.ok(Array.from({ length: pts.length / 4 }, (_, i) => pts[i * 4]).some(x => x < 0.25), 'the inked side is stippled');
  const again = hero.stipple(rgba, size, noise, 4, 32, 1, 0.7);
  assert.deepEqual(Array.from(again), Array.from(hero.stipple(rgba, size, noise, 4, 32, 1, 0.7)));
});

test('denser grids for bigger figures, within limits', () => {
  assert.equal(hero.resolutionFor(100), 280);
  assert.equal(hero.resolutionFor(5000), 640);
  assert.ok(hero.resolutionFor(700) > hero.resolutionFor(400));
});

test('the figure is centred in its box with the requested margin', () => {
  const placed = hero.fit([0.1, 0.2, 0.7, 0.9], 700, 14);
  const w = 0.6 * placed.scale, h = 0.7 * placed.scale;
  assert.ok(Math.abs(h - (700 - 28)) < 1e-9);
  assert.ok(Math.abs(placed.x + 0.1 * placed.scale - (700 - w) / 2) < 1e-9);
  assert.ok(Math.abs(placed.y + 0.2 * placed.scale - 14) < 1e-9);
});

test('the ring repeats whole names, separated by middle dots, and knows which name owns each glyph', () => {
  const words = ['AGENTCRUCIBLE', 'AIRFORGE', 'SHIPGATE'];
  const ring = hero.ringText(words, 2000, 8);
  const text = ring.glyphs.join('');
  assert.equal(ring.reps, Math.round(2000 / ((words.join(' · ') + ' · ').length * 8)));
  for (const lap of text.split(' · ').filter(Boolean)) assert.ok(words.includes(lap), `fragment "${lap}"`);
  const first = ring.glyphs.indexOf('S');
  assert.equal(words[ring.owner[first]], 'SHIPGATE');
  assert.equal(ring.owner[ring.glyphs.indexOf('·')], -1);
  assert.equal(hero.ringText(words, 10, 8).reps, 1);
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
  const png = fs.readFileSync(path.join(dir, 'data.png'));
  assert.equal(png.readUInt32BE(16), meta.size);
  assert.equal(png.readUInt32BE(20), meta.size);
  const chunks = [];
  for (let o = 8; o < png.length;) { const len = png.readUInt32BE(o); chunks.push(png.toString('ascii', o + 4, o + 8)); o += 12 + len; }
  for (const c of ['gAMA', 'iCCP', 'sRGB', 'cHRM']) assert.ok(!chunks.includes(c), `data.png must not carry ${c}, or browsers would color-manage the data`);
  const total = ['data.png', 'bluenoise.png', 'hero.json', 'color.webp'].reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  assert.ok(total < 200 * 1024, `hero data is ${total} bytes`);
  const webp = fs.readFileSync(path.join(dir, 'color.webp'));
  assert.equal(webp.toString('ascii', 0, 4), 'RIFF');
  assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
});

test('normals follow the depth map: flat ground faces the viewer, slopes tilt away from the rise, edges are one-sided', () => {
  const size = 16, rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    rgba[i] = x < 8 ? 128 : Math.min(255, 128 + (x - 7) * 30);  // flat on the left, rising to the right
    rgba[i + 1] = 255;
    rgba[i + 2] = y < 14 ? 255 : 0;                               // the last two rows are outside the mask
  }
  const at = (x, y) => new Float32Array([x / (size - 1), y / (size - 1), 0, 1]);
  const flat = hero.depthNormals(rgba, size, at(3, 6), 0.34);
  assert.deepEqual(Array.from(flat).map(Math.abs), [0, 0]);
  const slope = hero.depthNormals(rgba, size, at(11, 6), 0.34);
  assert.ok(slope[0] < -0.3, `a surface rising to the right tilts left, got nx ${slope[0]}`);
  assert.ok(Math.abs(slope[1]) < 1e-6, 'no tilt along y on a pure x ramp');
  assert.ok(Math.hypot(slope[0], slope[1]) <= 0.94 + 1e-6, 'tilt stays under the limit so nz is never zero');
  const edge = hero.depthNormals(rgba, size, at(11, 13), 0.34);
  assert.ok(Math.abs(edge[0] - slope[0]) < 1e-6, 'the row above the mask edge still gets its x slope from a one-sided y sample');
  const many = hero.depthNormals(rgba, size, hero.stipple(rgba, size, Uint8Array.from({ length: 16 }, (_, i) => i * 16), 4, 24, 1, 0), 0.34);
  assert.equal(many.length % 2, 0);
  for (let i = 0; i < many.length; i += 2) assert.ok(many[i] * many[i] + many[i + 1] * many[i + 1] < 1, 'every normal has a positive z');
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
  const out = hero.sampleColors(rgba, size, new Float32Array([...at(0, 0), ...at(3, 3), ...at(1.5, 0), ...at(3, 2.5)]));
  assert.deepEqual(Array.from(out.subarray(0, 4)), [200, 90, 30, 0]);
  assert.deepEqual(Array.from(out.subarray(4, 8)), [40, 90, 230, 255]);
  assert.deepEqual(Array.from(out.subarray(8, 12)), [120, 90, 30, 0], 'halfway between red and not-red');
  assert.deepEqual(Array.from(out.subarray(12, 16)), [40, 90, 230, 127], 'halfway into the sparkle');
  assert.equal(out.length, 16);
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
