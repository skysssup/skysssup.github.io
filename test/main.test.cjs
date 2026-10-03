const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

function element() {
  const attrs = new Map();
  return {
    attrs, listeners: {}, textContent: '', hidden: false,
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute(k, v) { attrs.set(k, String(v)); },
    getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
    removeAttribute(k) { attrs.delete(k); },
    hasAttribute(k) { return attrs.has(k); },
    addEventListener(k, f) { this.listeners[k] = f; },
    getBoundingClientRect: () => ({ left: 1000, top: 380, width: 24, height: 80, right: 1024, bottom: 460 }),
    focus() {},
  };
}

function page({ reduced = false, transitions = false } = {}) {
  const root = element();
  const animations = [];
  root.animate = (keyframes, options) => { animations.push({ keyframes, options }); return {}; };
  const body = element();
  const gear = element();
  const label = element();
  const flip = element();
  const ids = { gear, 'gear-label': label, flip };
  let timer = 0;
  const timers = new Map();
  const paints = [];
  const started = [];
  const media = { matches: reduced, addEventListener() {} };
  const document = {
    documentElement: root, body,
    getElementById: id => ids[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  if (transitions) {
    document.startViewTransition = run => {
      run();
      const ready = Promise.resolve();
      started.push(ready);
      return { ready };
    };
  }
  const window = {
    matchMedia: () => media,
    addEventListener() {},
    skyTheme: { paint: () => paints.push(root.getAttribute('data-gear')) },
  };
  vm.runInNewContext(source, {
    window, document, Intl, Promise, Math, String, Array, Number,
    innerWidth: 1024, innerHeight: 800,
    IntersectionObserver: class { observe() {} unobserve() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout: (fn, ms) => { timers.set(++timer, { fn, ms }); return timer; },
    clearTimeout: id => timers.delete(id),
    setInterval: () => 0,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  });
  const run = ms => {
    const due = [...timers.entries()].filter(([, t]) => t.ms === ms);
    due.forEach(([id, t]) => { timers.delete(id); t.fn(); });
  };
  run(900); // entrance fallback timer for slow font loading
  return { root, gear, label, window, timers, run, paints, animations, started };
}

test('Gear Two flashes, glitches into the red mode, settles, then clears', () => {
  const p = page();
  p.gear.listeners.click();
  assert.equal(p.root.getAttribute('data-phase'), 'flash');
  assert.equal(p.root.getAttribute('data-gear'), null);
  p.run(150);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.root.getAttribute('data-phase'), 'glitch');
  assert.equal(p.gear.getAttribute('aria-pressed'), 'true');
  assert.equal(p.label.textContent, 'REALITY');
  assert.deepEqual(p.paints, ['two']);
  p.run(800);
  assert.equal(p.root.getAttribute('data-phase'), 'settle');
  p.run(1400);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.timers.size, 0);
});

test('returning to reality glitches briefly before restoring the normal palette', () => {
  const p = page();
  p.window.skyGear.set(true);
  p.gear.listeners.click();
  assert.equal(p.root.getAttribute('data-phase'), 'glitch');
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  p.run(400);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.label.textContent, 'GEAR TWO');
});

test('rapid toggles cancel the previous sequence', () => {
  const p = page();
  p.gear.listeners.click();
  p.run(150);
  p.gear.listeners.click();
  assert.equal(p.timers.size, 1);
  assert.equal(p.root.getAttribute('data-phase'), 'glitch');
  p.run(400);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.timers.size, 0);
});

test('reduced motion switches gears immediately without flashes', () => {
  const p = page({ reduced: true });
  p.gear.listeners.click();
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.timers.size, 0);
});

test('the light switch flips the theme, and leaves Gear Two with the lights on', () => {
  const p = page();
  const applied = [];
  p.window.skyThemeTransition(theme => applied.push(theme), 'light');
  p.window.skyThemeTransition(theme => applied.push(theme), 'dark');
  p.window.skyGear.set(true);
  p.window.skyThemeTransition(theme => applied.push(theme), 'light');
  assert.deepEqual(applied, ['dark', 'light', 'light']);
  assert.equal(p.root.getAttribute('data-gear'), null);
});

test('the light switch reveals the new theme with a soft circle from the switch', async () => {
  const p = page({ transitions: true });
  const applied = [];
  p.window.skyThemeTransition(theme => applied.push(theme), 'light');
  assert.deepEqual(applied, ['dark']);
  await Promise.all(p.started);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(p.animations.length, 1);
  const { keyframes, options } = p.animations[0];
  assert.equal(options.pseudoElement, '::view-transition-new(root)');
  assert.equal(options.fill, 'forwards');
  assert.equal(keyframes.maskSize[0], '0px 0px');
  assert.equal(keyframes.maskPosition[0], '1012px 420px');
});
