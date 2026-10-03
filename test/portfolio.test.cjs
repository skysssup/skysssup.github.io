const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../portfolio.js'), 'utf8');

function page({ reduced = false, dark = false } = {}) {
  const nodes = new Map();
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    const value = {
      attrs: new Map(), listeners: {}, hidden: false, textContent: '',
      setAttribute(key, value) { this.attrs.set(key, value); },
      getAttribute(key) { return this.attrs.get(key); },
      removeAttribute(key) { this.attrs.delete(key); },
      addEventListener(key, fn) { this.listeners[key] = fn; },
      click() { return this.listeners.click?.(); },
      focus() { focused = id; },
      querySelector(selector) { return node(selector); },
      getContext() { return null; },
    };
    nodes.set(id, value);
    return value;
  }
  let focused = null;
  let timerId = 0;
  const timers = new Map();
  const documentListeners = {};
  const smoothers = [];
  const media = { matches: reduced, addEventListener(_, fn) { this.change = fn; } };
  const root = node('root');
  const flip = node('flip');
  flip.setAttribute('aria-pressed', String(dark));
  flip.addEventListener('click', () => flip.setAttribute('aria-pressed', String(flip.getAttribute('aria-pressed') !== 'true')));
  vm.runInNewContext(source, {
    document: {
      documentElement: root, hidden: false,
      getElementById: node,
      addEventListener: (name, fn) => { documentListeners[name] = fn; },
    },
    window: {
      matchMedia: () => media,
      addEventListener() {},
      Lenis: class { constructor() { this.destroyed = false; smoothers.push(this); } destroy() { this.destroyed = true; } },
    },
    Image: class {},
    IntersectionObserver: class { observe() {} },
    MutationObserver: class { observe() {} },
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }, setInterval() {},
  });
  return { node, root, flip, media, smoothers, timers, focused: () => focused };
}

test('Gear Two switches palette and completes flash, glitch, and settle phases', () => {
  const p = page();
  p.node('gear').click();
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.root.getAttribute('data-phase'), 'flash');
  assert.equal(p.node('gear').textContent, '[ REALITY ]');
  assert.equal(p.node('lights').getAttribute('aria-label'), 'Turn lights on');
  for (const [delay, phase] of [[150, 'glitch'], [800, 'settle'], [1400, undefined]]) {
    [...p.timers.values()].find(timer => timer.delay === delay).fn();
    assert.equal(p.root.getAttribute('data-phase'), phase);
  }
  assert.equal(p.timers.size, 0);
});

test('rapid Gear toggles cancel the previous transition timers', () => {
  const p = page();
  p.node('gear').click();
  const old = [...p.timers.keys()];
  p.node('gear').click();
  assert.equal(p.root.getAttribute('data-gear'), 'one');
  assert.equal(p.node('gear').getAttribute('aria-pressed'), 'false');
  assert.equal(p.timers.size, 3);
  assert.ok(old.every(id => !p.timers.has(id)));
});

test('reduced motion preserves controls without starting motion effects', () => {
  const p = page({ reduced: true });
  assert.equal(p.root.getAttribute('data-motion'), 'paused');
  assert.equal(p.smoothers.length, 0);
  p.node('gear').click();
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.root.getAttribute('data-phase'), undefined);
  assert.equal(p.timers.size, 0);
});

test('pausing motion cancels transition timers and destroys smooth scrolling', () => {
  const p = page();
  p.node('gear').click();
  p.node('motion').click();
  assert.equal(p.root.getAttribute('data-motion'), 'paused');
  assert.equal(p.root.getAttribute('data-phase'), undefined);
  assert.equal(p.timers.size, 0);
  assert.equal(p.smoothers[0].destroyed, true);
  p.node('motion').click();
  assert.equal(p.root.getAttribute('data-motion'), 'running');
  assert.equal(p.smoothers.length, 2);
});

test('a new reduced-motion preference stops a running experience', () => {
  const p = page();
  p.media.matches = true;
  p.media.change();
  assert.equal(p.root.getAttribute('data-motion'), 'paused');
  assert.equal(p.smoothers[0].destroyed, true);
});

test('side light switch falls back to a normal toggle without View Transitions', async () => {
  const p = page();
  await p.node('lights').click();
  assert.equal(p.flip.getAttribute('aria-pressed'), 'true');
  assert.equal(p.node('light-label').textContent, 'LIGHTS OFF');
  await p.node('lights').click();
  assert.equal(p.flip.getAttribute('aria-pressed'), 'false');
  assert.equal(p.node('light-label').textContent, 'LIGHTS ON');
});

test('turning lights on exits Gear Two from either underlying theme', async () => {
  for (const dark of [false, true]) {
    const p = page({ dark });
    p.node('gear').click();
    await p.node('lights').click();
    assert.equal(p.root.getAttribute('data-gear'), 'one');
    assert.equal(p.flip.getAttribute('aria-pressed'), 'false');
    assert.equal(p.node('lights').getAttribute('aria-label'), 'Turn lights off');
    assert.equal(p.timers.size, 0);
  }
});

test('about panel can be closed and reopened without losing keyboard focus', () => {
  const p = page();
  p.node('about-close').click();
  assert.equal(p.node('about-panel').hidden, true);
  assert.equal(p.node('about-open').getAttribute('aria-expanded'), 'false');
  assert.equal(p.focused(), 'about-open');
  p.node('about-open').click();
  assert.equal(p.node('about-panel').hidden, false);
  assert.equal(p.node('about-open').hidden, true);
  assert.equal(p.focused(), 'about-close');
});
