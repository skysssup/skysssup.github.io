const { test } = require('node:test');
const assert = require('node:assert/strict');
const dotfield = require('../js/dotfield.js');
const cat = require('../js/cat.js');
const mark = require('../js/mark.js');

test('ordered dither thresholds cover sixteen distinct levels inside (0, 1)', () => {
  const levels = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) levels.add(dotfield.bayer(x, y));
  assert.equal(levels.size, 16);
  for (const level of levels) assert.ok(level > 0 && level < 1);
  assert.equal(dotfield.bayer(5, 6), dotfield.bayer(1, 2));
});

test('every word row is a deterministic shuffle of the full vocabulary', () => {
  const words = row => dotfield.rowStream(row).split('/').filter(Boolean).sort();
  assert.deepEqual(words(0), words(9));
  assert.equal(dotfield.rowStream(3), dotfield.rowStream(3));
  const distinct = new Set(Array.from({ length: 12 }, (_, i) => dotfield.rowStream(i)));
  assert.ok(distinct.size > 3);
});

test('Gear Two heartbeat pulses twice per beat and rests in between', () => {
  const samples = Array.from({ length: 92 }, (_, i) => dotfield.heartbeat(i / 100));
  const peaks = samples.filter((v, i) => i > 0 && i < samples.length - 1 && v > samples[i - 1] && v >= samples[i + 1] && v > 0.3);
  assert.equal(peaks.length, 2);
  assert.ok(dotfield.heartbeat(0.6) < 0.05);
});

test('word gaps flow within a bounded range', () => {
  for (let i = 0; i < 400; i++) {
    const value = dotfield.flow(i % 37, i % 23, i / 7);
    assert.ok(value >= -1 && value <= 1);
  }
});

test('cat sprites are 16 by 16 and only use the outline, body, and accent colors', () => {
  for (const [name, rows] of Object.entries(cat.sprites)) {
    assert.equal(rows.length, 16, name);
    for (const row of rows) assert.match(row, /^[.kwp]{16}$/, name);
  }
  assert.deepEqual(cat.sprites.runL1, cat.sprites.runR1.map(r => [...r].reverse().join('')));
});

test('cat picks running and wall directions from the cursor and screen edges', () => {
  assert.equal(cat.heading(10, 1), 'R');
  assert.equal(cat.heading(-10, 2), 'L');
  assert.equal(cat.heading(1, -10), 'U');
  assert.equal(cat.heading(-2, 12), 'D');
  const view = { w: 800, h: 600 };
  assert.equal(cat.wallOf(10, 300, view.w, view.h), 'L');
  assert.equal(cat.wallOf(790, 300, view.w, view.h), 'R');
  assert.equal(cat.wallOf(400, 5, view.w, view.h), 'U');
  assert.equal(cat.wallOf(400, 590, view.w, view.h), 'D');
  assert.equal(cat.wallOf(400, 300, view.w, view.h), null);
});

test('cat chases the cursor, settles nearby, then dozes off', () => {
  const view = { w: 1000, h: 800 };
  const state = { x: 100, y: 400, frame: 0, idle: 0, state: 'sit', alertLeft: 0 };
  const target = { x: 600, y: 400, edge: false };
  const first = cat.step(state, target, view, 10);
  assert.match(first, /^runR[12]$/);
  for (let i = 0; i < 80; i++) cat.step(state, target, view, 10);
  assert.ok(Math.abs(target.x - state.x) <= 44);
  let sprite = '';
  for (let i = 0; i < 120; i++) sprite = cat.step(state, target, view, 10);
  assert.match(sprite, /^sleep[12]$/);
});

test('cat wakes up alert before running again', () => {
  const view = { w: 1000, h: 800 };
  const state = { x: 500, y: 400, frame: 0, idle: 40, state: 'sit', alertLeft: 0 };
  const sprite = cat.step(state, { x: 900, y: 400, edge: false }, view, 10);
  assert.equal(sprite, 'sit');
  assert.equal(state.state, 'alert');
  assert.equal(state.x, 500);
});

test('cat runs to the edge the cursor left through and scratches that wall', () => {
  const view = { w: 1000, h: 800 };
  const state = { x: 500, y: 400, frame: 0, idle: 0, state: 'run', alertLeft: 0 };
  const target = { x: 984, y: 400, edge: true };
  let sprite = '';
  for (let i = 0; i < 80; i++) sprite = cat.step(state, target, view, 10);
  assert.match(sprite, /^scratchR[12]$/);
});

test('arch mark rows contain every project name and dissolve only near the end of a cycle', () => {
  const names = mark.stream(4).split('/').filter(Boolean).sort();
  assert.deepEqual(names, [...mark.names].sort());
  assert.equal(mark.dissolveAt(1000), 0);
  assert.equal(mark.dissolveAt(6000), 0);
  assert.ok(mark.dissolveAt(7650) > 0.9);
  for (let ms = 0; ms < 18000; ms += 250) {
    const d = mark.dissolveAt(ms);
    assert.ok(d >= 0 && d <= 1);
  }
});
