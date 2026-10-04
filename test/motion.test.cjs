const { test } = require('node:test');
const assert = require('node:assert/strict');
const { init, GEAR } = require('../js/motion.js');

function element(rect) {
  const attrs = new Map();
  return {
    attrs,
    textContent: '',
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } },
    setAttribute(k, v) { attrs.set(k, String(v)); },
    getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
    removeAttribute(k) { attrs.delete(k); },
    querySelector() { return null; },
    getBoundingClientRect: () => rect || { left: 0, top: 0, width: 0, height: 0 },
  };
}

function page({ osReduced = false, saved = null, transitions = false, gear = false } = {}) {
  const root = element();
  if (gear) root.setAttribute('data-gear', 'two');
  const animations = [];
  root.animate = (keyframes, options) => { animations.push({ keyframes, options }); return {}; };
  const gearButton = element();
  const toggle = element();
  const state = { textContent: 'Off' };
  toggle.querySelector = () => state;
  const listeners = {};
  let saved_ = saved;
  const storage = { getItem: () => saved_, setItem: (k, v) => { saved_ = v; } };
  const session = new Map();
  const sessionStore = { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) };
  let id = 0;
  const timers = new Map();
  const mq = { matches: osReduced, addEventListener(k, f) { this.f = f; } };
  const doc = {
    documentElement: root,
    querySelector: () => null,
    querySelectorAll: sel => (sel === '[data-gear-toggle]' ? [gearButton] : sel === '[data-motion-toggle]' ? [toggle] : []),
    addEventListener: (k, f) => { listeners[k] = f; },
  };
  const started = [];
  if (transitions) {
    doc.startViewTransition = run => {
      run();
      const ready = Promise.resolve();
      started.push(ready);
      return { ready, finished: Promise.resolve() };
    };
  }
  const win = { matchMedia: () => mq, addEventListener() {}, innerWidth: 1440, innerHeight: 900, skyTheme: { paint() {} } };
  const api = init({
    document: doc, window: win, storage, session: sessionStore,
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimeout: t => timers.delete(t),
  });
  const run = ms => [...timers.entries()].filter(([, t]) => t.ms === ms).forEach(([k, t]) => { timers.delete(k); t.fn(); });
  const click = el => listeners.click({ target: { closest: sel => (sel === '[data-gear-toggle]' && el === gearButton) || (sel === '[data-motion-toggle]' && el === toggle) ? el : null } });
  return { api, root, gearButton, toggle, state, timers, run, click, win, animations, started, session, mq, getSaved: () => saved_ };
}

test('Gear Two flashes, switches to red while glitching, settles, then clears', () => {
  const p = page();
  p.click(p.gearButton);
  assert.equal(p.root.getAttribute('data-phase'), 'flash');
  assert.equal(p.root.getAttribute('data-gear'), null);
  p.run(GEAR.flash);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.root.getAttribute('data-phase'), 'glitch');
  assert.equal(p.gearButton.getAttribute('aria-pressed'), 'true');
  assert.equal(p.session.get('sky-gear'), 'two');
  p.run(GEAR.settle);
  assert.equal(p.root.getAttribute('data-phase'), 'settle');
  p.run(GEAR.done);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.timers.size, 0);
});

test('leaving Gear Two glitches briefly, then restores the palette and forgets the session flag', () => {
  const p = page({ gear: true });
  assert.equal(p.gearButton.getAttribute('aria-pressed'), 'true');
  p.click(p.gearButton);
  assert.equal(p.root.getAttribute('data-phase'), 'glitch');
  p.run(GEAR.exit);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.gearButton.getAttribute('aria-pressed'), 'false');
  assert.equal(p.session.has('sky-gear'), false);
});

test('a second press cancels the running sequence', () => {
  const p = page();
  p.click(p.gearButton);
  p.run(GEAR.flash);
  p.click(p.gearButton);
  assert.equal(p.timers.size, 1);
  p.run(GEAR.exit);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.timers.size, 0);
});

test('with reduced motion Gear Two switches at once', () => {
  const p = page({ osReduced: true });
  assert.equal(p.root.getAttribute('data-motion'), 'reduced');
  p.click(p.gearButton);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.timers.size, 0);
});

test('the footer toggle overrides the OS setting and is saved', () => {
  const p = page();
  assert.equal(p.api.motion.reduced(), false);
  let calls = 0;
  p.api.motion.subscribe(() => calls++);
  p.click(p.toggle);
  assert.equal(p.api.motion.reduced(), true);
  assert.equal(p.root.getAttribute('data-motion'), 'reduced');
  assert.equal(p.toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(p.state.textContent, 'On');
  assert.equal(p.getSaved(), 'reduced');
  assert.equal(calls, 1);
  const q = page({ osReduced: true, saved: 'full' });
  assert.equal(q.api.motion.reduced(), false);
  assert.equal(q.root.getAttribute('data-motion'), null);
});

test('the light switch flips the theme, and turning the lights on leaves Gear Two', () => {
  const p = page();
  const applied = [];
  p.win.skyThemeTransition(t => applied.push(t), 'light', null);
  p.win.skyThemeTransition(t => applied.push(t), 'dark', null);
  p.api.setGear(true);
  p.win.skyThemeTransition(t => applied.push(t), 'light', null);
  assert.deepEqual(applied, ['dark', 'light', 'light']);
  assert.equal(p.root.getAttribute('data-gear'), null);
});

test('the theme reveal grows a soft circle from the switch', async () => {
  const p = page({ transitions: true });
  const origin = element({ left: 1376, top: 21, width: 26, height: 14 });
  const applied = [];
  p.win.skyThemeTransition(t => applied.push(t), 'light', origin);
  assert.deepEqual(applied, ['dark']);
  await Promise.all(p.started);
  await new Promise(r => setImmediate(r));
  assert.equal(p.animations.length, 1);
  const { keyframes, options } = p.animations[0];
  assert.equal(options.pseudoElement, '::view-transition-new(root)');
  assert.equal(keyframes.maskSize[0], '0px 0px');
  assert.equal(keyframes.maskPosition[0], '1389px 28px');
  assert.equal(p.root.classList.contains('theme-reveal'), false);
});
