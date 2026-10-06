const { test } = require('node:test');
const assert = require('node:assert/strict');
const { init, GEAR, BLUE, BEAT, TIDE } = require('../js/motion.js');

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
  if (gear) root.setAttribute('data-gear', gear === true ? 'two' : gear);
  const animations = [];
  root.animate = (keyframes, options) => { animations.push({ keyframes, options }); return {}; };
  const gearButton = element();
  const blueButton = element();
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
    querySelectorAll: sel => (sel === '[data-gear-toggle]' ? [gearButton] : sel === '[data-gear-blue]' ? [blueButton] : sel === '[data-motion-toggle]' ? [toggle] : []),
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
  const click = el => listeners.click({ target: { closest: sel => (sel === '[data-gear-toggle]' && el === gearButton) || (sel === '[data-gear-blue]' && el === blueButton) || (sel === '[data-motion-toggle]' && el === toggle) ? el : null } });
  const pressed = () => [gearButton.getAttribute('aria-pressed'), blueButton.getAttribute('aria-pressed')];
  return { api, root, gearButton, blueButton, pressed, toggle, state, timers, run, click, win, doc, animations, started, session, mq, getSaved: () => saved_ };
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

test('the theme reveal grows a soft circle from the switch without covering the live page', () => {
  const p = page({ transitions: true });
  const origin = element({ left: 1376, top: 21, width: 26, height: 14 });
  const appended = [];
  p.doc.createElement = () => ({ className: '', style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); }, pointerEvents: '' }, setAttribute() {}, addEventListener() {} });
  p.doc.body = { appendChild(el) { appended.push(el); } };
  const applied = [];
  p.win.skyThemeTransition(t => applied.push(t), 'light', origin);
  assert.deepEqual(applied, ['dark'], 'the live theme changes at once');
  assert.equal(appended.length, 1);
  assert.equal(appended[0].className, 'fx-flood');
  assert.equal(appended[0].style.pointerEvents, 'none', 'the circle cannot swallow the next press');
  assert.equal(appended[0].style.left, '1389px');
  assert.equal(p.root.classList.contains('theme-reveal'), false, 'no root snapshot covers the hero');
  assert.equal(p.started.length, 0, 'in-page modes do not snapshot the root');
});

test('switching Gear Two on sends a red ring out from the switch and phases the heartbeat to the clock', () => {
  const p = page();
  const appended = [];
  const removed = [];
  p.root.style = { props: new Map(), setProperty(k, v) { this.props.set(k, v); } };
  p.win.performance = { now: () => 1234 };
  const origin = element({ left: 619, top: 14, width: 82, height: 28 });
  const fake = { className: '', style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); } }, attrs: new Map(), listeners: {}, parentNode: null,
    setAttribute(k, v) { this.attrs.set(k, v); }, addEventListener(k, f) { this.listeners[k] = f; } };
  p.doc.createElement = () => fake;
  p.doc.body = { appendChild(el) { appended.push(el); el.parentNode = { removeChild(e) { removed.push(e); e.parentNode = null; } }; } };
  p.api.toggleGear(origin);
  assert.equal(appended.length, 1);
  assert.equal(fake.className, 'fx-ring');
  assert.equal(fake.style.left, '660px');
  assert.equal(fake.style.top, '28px');
  assert.ok(parseInt(fake.style.props.get('--reach'), 10) > 2 * Math.hypot(1440 - 660, 900 - 28), 'the ring reaches past the far corner');
  p.run(GEAR.flash);
  assert.equal(p.root.style.props.get('--beat-delay'), '-0.334s', '1234 ms into the clock, the beat is 0.334 s along its 0.9 s cycle');
  fake.listeners.animationend();
  assert.deepEqual(removed, [fake]);
  p.run(GEAR.settle);
  p.run(GEAR.done);
  assert.equal(p.timers.size, 1, 'only the ring safety timer remains');
  p.run(1400);
  assert.equal(removed.length, 1, 'the safety timer finds the ring already gone');
});

test('leaving Gear Two sends no ring, and reduced motion sends none either', () => {
  const p = page({ gear: true });
  let created = 0;
  p.doc.createElement = () => { created++; return {}; };
  p.doc.body = { appendChild() {} };
  p.api.toggleGear(element({ left: 0, top: 0, width: 10, height: 10 }));
  assert.equal(created, 0);
  const q = page({ osReduced: true });
  q.doc.createElement = () => { created++; return {}; };
  q.doc.body = { appendChild() {} };
  q.api.toggleGear(element({ left: 0, top: 0, width: 10, height: 10 }));
  assert.equal(created, 0);
  assert.equal(q.root.getAttribute('data-gear'), 'two');
});

test('the opening can take Gear Two on and back off without saving it to the session', () => {
  const p = page();
  p.api.switchGear(true, p.gearButton, true);
  p.run(GEAR.flash);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.session.has('sky-gear'), false, 'a visitor who leaves now does not carry Gear Two to the next page');
  p.api.switchGear(true, p.gearButton, true);
  assert.equal(p.root.getAttribute('data-phase'), null, 'asking for the state it is in cancels what was running and does nothing else');
  p.api.switchGear(false, null, true);
  p.run(GEAR.exit);
  assert.equal(p.root.getAttribute('data-gear'), null);
  p.click(p.gearButton);
  p.run(GEAR.flash);
  assert.equal(p.session.get('sky-gear'), 'two', 'a visitor\'s own switch is saved as before');
});

// Tide, the blue gear: reached only from its position in the gear shift, never by the opening.
function clocked(p, now = 1234) {
  p.root.style = { props: new Map(), setProperty(k, v) { this.props.set(k, v); } };
  p.win.performance = { now: () => now };
  return p;
}

test('Tide surges from neutral: the knob moves at once, the palette turns at 120 ms with the tide phased to the clock, and the surge clears', () => {
  const p = clocked(page());
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-phase'), 'surge');
  assert.equal(p.root.getAttribute('data-gear'), null, 'the palette waits for the surge');
  assert.deepEqual(p.pressed(), ['false', 'true'], 'the position is pressed at once, so the knob moves as it is pressed');
  p.run(BLUE.palette);
  assert.equal(p.root.getAttribute('data-gear'), 'blue');
  assert.equal(p.root.getAttribute('data-phase'), 'surge', 'the surge runs on after the palette turns');
  assert.equal(p.session.get('sky-gear'), 'blue');
  assert.equal(p.root.style.props.get('--tide-delay'), '-1.234s', '1234 ms into the clock, the tide is 1.234 s along its 4.5 s cycle');
  assert.equal(p.root.style.props.has('--beat-delay'), false, 'no heartbeat in Tide');
  assert.equal(p.api.isGear(), true);
  assert.equal(p.api.mode(), 'blue');
  p.run(BLUE.done);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.timers.size, 0);
  assert.equal(TIDE, 4.5);
  assert.equal(p.api.TIDE, TIDE);
  assert.ok(BLUE.palette < BLUE.done && BLUE.exit < BLUE.done, 'leaving is quicker than arriving');
});

test('leaving Tide ebbs quietly, then the page comes back and forgets the session flag', () => {
  const p = page({ gear: 'blue' });
  assert.deepEqual(p.pressed(), ['false', 'true']);
  assert.equal(p.session.get('sky-gear'), 'blue');
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-phase'), 'ebb');
  assert.equal(p.root.getAttribute('data-gear'), 'blue', 'the gear clears after the ebb');
  assert.deepEqual(p.pressed(), ['false', 'false'], 'the knob goes back to neutral at once');
  p.run(BLUE.exit);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.session.has('sky-gear'), false);
  assert.equal(p.timers.size, 0);
  assert.equal(p.api.isGear(), false);
});

test('the gears run none, Gear Two, Tide, none; switching straight between them runs the new gear\'s entrance', () => {
  const p = page();
  p.click(p.gearButton);
  p.run(GEAR.flash);
  p.run(GEAR.settle);
  p.run(GEAR.done);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.session.get('sky-gear'), 'two');
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-phase'), 'surge', 'red to blue surges, without Gear Two\'s glitch');
  assert.deepEqual(p.pressed(), ['false', 'true']);
  p.run(BLUE.palette);
  assert.equal(p.root.getAttribute('data-gear'), 'blue');
  assert.equal(p.session.get('sky-gear'), 'blue');
  p.run(BLUE.done);
  p.click(p.gearButton);
  assert.equal(p.root.getAttribute('data-phase'), 'flash', 'blue to red flashes and glitches like Gear Two from neutral');
  p.run(GEAR.flash);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.root.getAttribute('data-phase'), 'glitch');
  p.run(GEAR.settle);
  p.run(GEAR.done);
  p.click(p.blueButton);
  p.run(BLUE.palette);
  p.run(BLUE.done);
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-phase'), 'ebb');
  p.run(BLUE.exit);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.session.has('sky-gear'), false);
  assert.equal(p.timers.size, 0);
});

test('a press on Tide while its surge runs returns to neutral before the palette turns', () => {
  const p = page();
  p.click(p.blueButton);
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.timers.size, 0, 'the palette never turns');
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.deepEqual(p.pressed(), ['false', 'false']);
  assert.equal(p.session.has('sky-gear'), false);
});

test('a transient switch is never saved, and leaves the gear chosen by hand in the session', () => {
  const p = page({ gear: 'blue' });
  p.api.switchGear(true, p.gearButton, true);
  p.run(GEAR.flash);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.session.get('sky-gear'), 'blue');
  p.api.switchGear(false, null, true);
  p.run(GEAR.exit);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.session.get('sky-gear'), 'blue', 'the opening\'s way back does not forget the visitor\'s gear either');
  const q = page();
  q.api.switchGear('blue', q.blueButton, true);
  q.run(BLUE.palette);
  assert.equal(q.root.getAttribute('data-gear'), 'blue');
  assert.equal(q.session.has('sky-gear'), false);
});

test('with reduced motion every switch between the gears is instant, with no phases and no rings', () => {
  const p = clocked(page({ osReduced: true }));
  let created = 0;
  p.doc.createElement = () => { created++; return {}; };
  p.doc.body = { appendChild() {} };
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-gear'), 'blue');
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.root.style.props.get('--tide-delay'), '-1.234s');
  p.click(p.gearButton);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.root.getAttribute('data-phase'), null);
  p.click(p.blueButton);
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.timers.size, 0);
  assert.equal(created, 0);
});

test('the lights leave either gear, also in the middle of a surge', () => {
  const p = page({ gear: 'blue' });
  const applied = [];
  p.win.skyThemeTransition(t => applied.push(t), 'dark', null);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.deepEqual(p.pressed(), ['false', 'false']);
  assert.equal(p.session.has('sky-gear'), false);
  p.click(p.blueButton);
  p.win.skyThemeTransition(t => applied.push(t), 'dark', null);
  assert.equal(p.timers.size, 0, 'the surge is cancelled before its palette turns');
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.deepEqual(p.pressed(), ['false', 'false']);
  p.api.setGear('two');
  p.win.skyThemeTransition(t => applied.push(t), 'light', null);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.deepEqual(applied, ['light', 'light', 'light'], 'leaving a gear turns the lights on');
});

test('true and false still mean Gear Two and none, so the opening and the hero\'s tests switch as before', () => {
  const p = page();
  p.api.setGear(true);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  assert.equal(p.api.mode(), 'two');
  assert.equal(p.api.isGear(), true);
  p.api.setGear(false);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.api.mode(), null);
  p.api.switchGear(true, p.gearButton);
  assert.equal(p.root.getAttribute('data-phase'), 'flash');
  p.run(GEAR.flash);
  assert.equal(p.root.getAttribute('data-gear'), 'two');
  p.api.switchGear(null);
  p.run(GEAR.exit);
  assert.equal(p.root.getAttribute('data-gear'), null);
  p.api.setGear('sideways');
  assert.equal(p.root.getAttribute('data-gear'), null, 'an unknown gear is neutral');
  assert.equal(BEAT, 0.9);
});

test('Tide floods from the control without a root snapshot, and a second press wins', () => {
  const p = page({ transitions: true });
  const rings = [];
  p.doc.createElement = () => ({ className: '', style: { setProperty() {}, pointerEvents: '' }, setAttribute() {}, addEventListener() {} });
  p.doc.body = { appendChild(el) { rings.push(el); } };
  p.blueButton.getBoundingClientRect = () => ({ left: 680, top: 14, width: 54, height: 28 });
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-phase'), 'surge');
  assert.equal(p.root.getAttribute('data-gear'), null, 'the palette waits for the short acknowledgment');
  p.run(BLUE.palette);
  assert.equal(p.root.getAttribute('data-gear'), 'blue');
  assert.equal(p.root.classList.contains('theme-reveal'), false, 'the live hero is not covered by an old picture');
  assert.equal(p.started.length, 0);
  assert.equal(rings.length, 1);
  assert.equal(rings[0].className, 'fx-tide');
  assert.equal(rings[0].style.pointerEvents, 'none');
  assert.equal(rings[0].style.left, '707px', 'the ring leaves the middle of Tide\'s position');

  const q = page({ transitions: true });
  q.blueButton.getBoundingClientRect = () => ({ left: 680, top: 14, width: 54, height: 28 });
  q.click(q.blueButton);
  q.click(q.blueButton);
  q.run(BLUE.palette);
  assert.equal(q.root.getAttribute('data-gear'), null, 'the second press returns to neutral and the old flood cannot reapply Tide');
});

test('leaving Tide returns to the live page once the ebb is over, without a snapshot', () => {
  const p = page({ gear: 'blue', transitions: true });
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-phase'), 'ebb');
  assert.equal(p.root.getAttribute('data-gear'), 'blue', 'the ebb does not freeze the old gear under a picture');
  p.run(BLUE.exit);
  assert.equal(p.root.getAttribute('data-gear'), null);
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.root.classList.contains('tide-ebb'), false);
  assert.equal(p.started.length, 0);
});

test('reduced motion during a Tide surge commits the requested gear and drops the ceremony', () => {
  const p = page();
  p.click(p.blueButton);
  assert.equal(p.root.getAttribute('data-phase'), 'surge');
  p.api.motion.set('reduced');
  assert.equal(p.root.getAttribute('data-gear'), 'blue');
  assert.equal(p.root.getAttribute('data-phase'), null);
  assert.equal(p.root.getAttribute('data-motion'), 'reduced');
  p.run(BLUE.palette);
  p.run(BLUE.done);
  assert.equal(p.root.getAttribute('data-gear'), 'blue', 'the old timers cannot restart the flood');
  assert.equal(p.root.getAttribute('data-phase'), null);
});
