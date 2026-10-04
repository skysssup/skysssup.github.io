const { test } = require('node:test');
const assert = require('node:assert/strict');
const diagram = require('../js/diagram.js');

const spec = { nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] };

test('wide diagrams run left to right with equal boxes that fill the width', () => {
  const plan = diagram.layout(spec, 900);
  assert.equal(plan.horizontal, true);
  const [a, b, c] = ['a', 'b', 'c'].map(k => plan.boxes[k]);
  assert.equal(a.x, 0);
  assert.ok(Math.abs(c.x + c.w - 900) < 1e-9);
  assert.ok(Math.abs(a.w - b.w) < 1e-9 && Math.abs(b.w - c.w) < 1e-9);
  assert.ok(b.x > a.x + a.w && c.x > b.x + b.w);
});

test('narrow diagrams stack top to bottom at full width', () => {
  const plan = diagram.layout(spec, 340);
  assert.equal(plan.horizontal, false);
  assert.equal(plan.boxes.a.w, 340);
  assert.ok(plan.boxes.b.y > plan.boxes.a.y + plan.boxes.a.h);
  assert.ok(plan.size.h >= plan.boxes.c.y + plan.boxes.c.h);
});

test('connectors leave and enter on the facing edges', () => {
  const plan = diagram.layout(spec, 900);
  const [x1, y1, x2, y2] = diagram.connector(plan.boxes.a, plan.boxes.b, true);
  assert.equal(x1, plan.boxes.a.x + plan.boxes.a.w);
  assert.equal(x2, plan.boxes.b.x);
  assert.equal(y1, y2);
  const v = diagram.layout(spec, 300);
  const [, vy1, , vy2] = diagram.connector(v.boxes.a, v.boxes.b, false);
  assert.equal(vy1, v.boxes.a.y + v.boxes.a.h);
  assert.equal(vy2, v.boxes.b.y);
});
