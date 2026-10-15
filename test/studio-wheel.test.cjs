const { test } = require('node:test');
const assert = require('node:assert/strict');
const wheel = require('../js/studio-wheel.js');

const G = wheel.GEOMETRY;

function pose(delta, height) {
  var theta = G.theta * delta;
  return {
    x: G.x + G.radius * (1 - Math.cos(theta)),
    y: (height - G.tileHeight) / 2 + G.radius * Math.sin(theta),
    rotation: -theta,
    scale: 1 - G.scaleDrop * Math.min(Math.abs(delta), 1),
  };
}

test('wrapDelta stays on the short arc and tracks position continuously', () => {
  assert.equal(wheel.wrapDelta(0, 0, 8), 0);
  assert.equal(wheel.wrapDelta(1, 0, 8), 1);
  assert.equal(wheel.wrapDelta(7, 0, 8), -1);
  assert.equal(wheel.wrapDelta(0, 0.25, 8), -0.25);
  assert.ok(Math.abs(wheel.wrapDelta(0, 4.6, 5) - 0.4) < 1e-12);
  assert.ok(Math.abs(wheel.wrapDelta(0, 0.4, 1) + 0.4) < 1e-12);
  assert.equal(wheel.nearestTarget(0.4, 0, 1), 0);
  assert.equal(Math.abs(wheel.wrapDelta(4, 0, 8)), 4);

  var count = 8;
  var step = 0.01;
  for (var position = 0; position < count; position += step) {
    for (var item = 0; item < count; item++) {
      var before = wheel.wrapDelta(item, position, count);
      var after = wheel.wrapDelta(item, position + step, count);
      if (Math.abs(before) > count / 2 - 0.2) continue;
      if (Math.abs(after) > count / 2 - 0.2) continue;
      assert.ok(Math.abs((after - before) - (-step)) < 1e-9, 'delta should follow -position');
    }
  }
});

test('nearestTarget picks the closest cyclic copy', () => {
  assert.equal(wheel.nearestTarget(0.2, 7, 8), -1);
  assert.equal(wheel.nearestTarget(0.2, 0, 8), 0);
  assert.equal(wheel.nearestTarget(7.6, 0, 8), 8);
  assert.equal(wheel.nearestTarget(3.4, 3, 8), 3);
  assert.equal(wheel.nearestTarget(-0.4, 7, 8), -1);
  assert.equal(wheel.nearestTarget(0.4, 0, 1), 0);
  assert.equal(wheel.selectedIndex(0.4, 8), 0);
  assert.equal(wheel.selectedIndex(0.6, 8), 1);
  assert.equal(wheel.selectedIndex(-0.6, 8), 7);
  assert.equal(wheel.selectedIndex(8.2, 8), 0);
});

test('projection matches the desktop rail and stays continuous off the branch cut', () => {
  var height = G.windowHeight;
  var origin = wheel.project(0, 5, height).poses[0];
  var expected = pose(0, height);
  assert.equal(origin.x, expected.x);
  assert.equal(origin.y, (height - G.tileHeight) / 2);
  assert.equal(origin.y, expected.y);
  assert.equal(origin.scale, 1);
  assert.equal(origin.rotation, 0);

  var neighbor = wheel.project(0, 5, height).poses[1];
  var neighborExpected = pose(1, height);
  assert.ok(Math.abs(neighbor.scale - 0.64) < 1e-12);
  assert.ok(Math.abs(neighbor.x - neighborExpected.x) < 1e-9);
  assert.ok(Math.abs(neighbor.y - neighborExpected.y) < 1e-9);
  assert.equal(neighbor.rotation, -G.theta);
  assert.equal(wheel.project(0, 5, height).poses[2].scale, 0.64);

  var shorter = wheel.project(0, 3, 400).poses[0];
  assert.equal(shorter.y, (400 - G.tileHeight) / 2);

  var count = 8;
  var step = 0.01;
  for (var position = 0; position < 3; position += step) {
    var left = wheel.project(position, count, height);
    var right = wheel.project(position + step, count, height);
    assert.equal(left.height, height);
    assert.equal(left.poses.length, count);
    for (var i = 0; i < count; i++) {
      if (Math.abs(left.poses[i].delta) > count / 2 - 0.2) continue;
      if (Math.abs(right.poses[i].delta) > count / 2 - 0.2) continue;
      assert.ok(Math.abs(left.poses[i].x - right.poses[i].x) < 1.5);
      assert.ok(Math.abs(left.poses[i].y - right.poses[i].y) < 12);
      assert.ok(Math.abs(left.poses[i].rotation - right.poses[i].rotation) < 0.01);
      assert.ok(Math.abs(left.poses[i].scale - right.poses[i].scale) < 0.02);
      assert.ok(Number.isFinite(left.poses[i].x + left.poses[i].y + left.poses[i].rotation + left.poses[i].scale));
    }
  }
});

test('spring approaches without overshoot, survives interruption, and settles in finite time', () => {
  var omega = wheel.SPRING.omega;
  var rest = { position: 0, velocity: 0, target: 2 };
  var untouched = wheel.stepSpring(rest, 0.1, omega);
  assert.equal(rest.position, 0);
  assert.equal(rest.velocity, 0);
  assert.notEqual(untouched, rest);

  var previous = 0;
  var sawVelocity = false;
  for (var t = 0.02; t <= 2; t += 0.02) {
    var sample = wheel.stepSpring({ position: 0, velocity: 0, target: 2 }, t, omega);
    assert.ok(sample.position >= previous - 1e-9);
    assert.ok(sample.position <= 2 + 1e-9);
    assert.ok(Number.isFinite(sample.position) && Number.isFinite(sample.velocity));
    if (sample.velocity > 0) sawVelocity = true;
    previous = sample.position;
  }
  assert.equal(sawVelocity, true);
  var done = wheel.stepSpring({ position: 0, velocity: 0, target: 2 }, 2, omega);
  assert.equal(done.settled, true);
  assert.equal(done.position, 2);
  assert.equal(done.velocity, 0);

  var held = { position: 4, velocity: 0, target: 4 };
  var stay = wheel.stepSpring(held, 0.5, omega);
  assert.equal(stay.settled, true);
  assert.equal(stay.position, 4);

  var mid = wheel.stepSpring({ position: 0, velocity: 1.5, target: 5 }, 0.12, omega);
  assert.equal(mid.settled, false);
  var redirected = wheel.nearestTarget(mid.position, 1, 8);
  assert.notEqual(redirected, 5);
  var spliced = { position: mid.position, velocity: mid.velocity, target: redirected };
  assert.equal(spliced.position, mid.position);
  var carried = wheel.stepSpring(spliced, 1 / 120, omega);
  assert.ok(Math.abs(carried.position - mid.position) < Math.abs(mid.velocity) / 60 + 0.02);
  assert.ok(Number.isFinite(carried.velocity));

  var state = spliced;
  var settled = false;
  for (var step = 0; step < 180; step++) {
    state = wheel.stepSpring(state, 1 / 60, omega);
    if (state.settled) { settled = true; break; }
  }
  assert.equal(settled, true);
  assert.equal(state.position, redirected);
  assert.equal(state.velocity, 0);
  assert.ok(Math.abs(state.position - 5) > 1);
});

test('reduced aim commits the nearest cyclic target and drops velocity', () => {
  var moving = { position: 0.2, velocity: 3, target: 0.2 };
  var committed = wheel.aim(moving, 7, 8, true);
  assert.equal(committed.target, -1);
  assert.equal(committed.position, -1);
  assert.equal(committed.velocity, 0);
  assert.equal(committed.settled, true);
  assert.equal(moving.position, 0.2);

  var armed = wheel.aim(moving, 7, 8, false);
  assert.equal(armed.target, -1);
  assert.equal(armed.position, 0.2);
  assert.equal(armed.velocity, 3);
  assert.equal(armed.settled, false);
});
