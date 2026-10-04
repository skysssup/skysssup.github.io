const { test } = require('node:test');
const assert = require('node:assert/strict');
const cat = require('../js/cat.js');

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

test('cat stays between the header and the footer, and scratches the footer edge it is stopped by', () => {
  const view = { w: 1000, h: 800, top: 56, bottom: 620 };
  assert.equal(cat.wallOf(500, 80, view.w, view.h, view.top, view.bottom), 'U');
  assert.equal(cat.wallOf(500, 600, view.w, view.h, view.top, view.bottom), 'D');
  assert.equal(cat.wallOf(500, 300, view.w, view.h, view.top, view.bottom), null);
  const state = { x: 500, y: 400, frame: 0, idle: 0, state: 'run', alertLeft: 0 };
  let sprite = '';
  for (let i = 0; i < 80; i++) sprite = cat.step(state, { x: 500, y: 784, edge: true }, view, 10);
  assert.equal(state.y, view.bottom - 16);
  assert.match(sprite, /^scratchD[12]$/);
  for (let i = 0; i < 80; i++) cat.step(state, { x: 500, y: 10, edge: false }, view, 10);
  assert.ok(state.y >= view.top + 16, `cat at ${state.y} went under the header`);
});
