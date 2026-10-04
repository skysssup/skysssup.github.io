const { test } = require('node:test');
const assert = require('node:assert/strict');
const demo = require('../js/demo.js');

test('a framed demo is denied the camera and the microphone', () => {
  const denied = Object.fromEntries(demo.DENY.split(';').map(s => s.trim().split(' ')));
  assert.equal(denied.camera, "'none'");
  assert.equal(denied.microphone, "'none'");
});
