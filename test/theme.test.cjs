const { test } = require('node:test');
const assert = require('node:assert/strict');
const { init, COLORS } = require('../js/theme.js');

function page({ saved = null, dark = false, blocked = false, legacy = false } = {}) {
  const attrs = new Map();
  const listeners = {};
  const lamp = { attrs: new Map(), setAttribute(k, v) { this.attrs.set(k, v); }, getAttribute(k) { return this.attrs.get(k); }, getBoundingClientRect: () => ({ left: 1380, top: 18, width: 26, height: 14 }) };
  const root = { getAttribute: k => (attrs.has(k) ? attrs.get(k) : null), setAttribute: (k, v) => attrs.set(k, String(v)), removeAttribute: k => attrs.delete(k) };
  const meta = { setAttribute(k, v) { this[k] = v; } };
  const mq = { matches: dark };
  if (legacy) mq.addListener = f => { listeners.scheme = f; };
  else mq.addEventListener = (k, f) => { listeners.scheme = f; };
  const storage = { getItem() { if (blocked) throw new Error('blocked'); return saved; }, setItem(k, v) { if (blocked) throw new Error('blocked'); saved = v; } };
  const doc = {
    documentElement: root,
    querySelectorAll: sel => (sel === '[data-lamp]' ? [lamp] : []),
    querySelector: sel => (sel.startsWith('meta') ? meta : null),
    addEventListener: (k, f) => { listeners[k] = f; },
  };
  const win = { matchMedia: () => mq, addEventListener: (k, f) => { listeners['win:' + k] = f; } };
  const api = init(doc, win, storage);
  const click = () => listeners.click({ target: { closest: sel => (sel === '[data-lamp]' ? lamp : null) } });
  return { api, attrs, lamp, meta, mq, listeners, win, click, setSaved: v => { saved = v; } };
}

test('follows the OS until a choice is made, and the switch reads "lights on" in light mode', () => {
  const p = page();
  assert.equal(p.lamp.attrs.get('aria-pressed'), 'true');
  assert.equal(p.meta.content, COLORS.light);
  p.mq.matches = true;
  p.listeners.scheme();
  assert.equal(p.lamp.attrs.get('aria-pressed'), 'false');
  assert.equal(p.meta.content, COLORS.dark);
});

test('a choice made in this tab survives OS changes even when storage is blocked', () => {
  const p = page({ blocked: true });
  p.click();
  assert.equal(p.attrs.get('data-theme'), 'dark');
  p.mq.matches = false;
  p.listeners.scheme();
  assert.equal(p.attrs.get('data-theme'), 'dark');
  assert.equal(p.lamp.attrs.get('aria-pressed'), 'false');
});

test('a saved light choice overrides a dark OS', () => {
  const p = page({ saved: 'light', dark: true });
  assert.equal(p.attrs.get('data-theme'), 'light');
  assert.equal(p.lamp.attrs.get('aria-pressed'), 'true');
  assert.equal(p.meta.content, COLORS.light);
});

test('other tabs change or reset the theme through storage events', () => {
  const p = page({ saved: 'dark' });
  p.setSaved('light');
  p.listeners['win:storage']({ key: 'sky-theme' });
  assert.equal(p.attrs.get('data-theme'), 'light');
  p.setSaved(null);
  p.mq.matches = true;
  p.listeners['win:storage']({ key: null });
  assert.equal(p.attrs.has('data-theme'), false);
  assert.equal(p.lamp.attrs.get('aria-pressed'), 'false');
});

test('unrelated storage keys and invalid saved values are ignored; legacy listeners work', () => {
  const p = page({ saved: 'dark' });
  p.setSaved('light');
  p.listeners['win:storage']({ key: 'other' });
  assert.equal(p.attrs.get('data-theme'), 'dark');
  const q = page({ saved: 'sepia', legacy: true });
  assert.equal(q.attrs.has('data-theme'), false);
  q.mq.matches = true;
  q.listeners.scheme();
  assert.equal(q.lamp.attrs.get('aria-pressed'), 'false');
});

test('Gear Two reads as lights off, and an installed transition receives the switch as its origin', () => {
  const p = page();
  p.attrs.set('data-gear', 'two');
  p.api.paint();
  assert.equal(p.lamp.attrs.get('aria-pressed'), 'false');
  assert.equal(p.meta.content, COLORS.gear);
  let seen = null;
  p.win.skyThemeTransition = (apply, current, origin) => { seen = { current, origin }; apply('light'); };
  p.click();
  assert.equal(seen.current, 'light');
  assert.equal(seen.origin, p.lamp);
  assert.equal(p.attrs.get('data-theme'), 'light');
});

test('Tide reads as lights off too, with its own paper as the theme colour', () => {
  const p = page();
  p.attrs.set('data-gear', 'blue');
  p.api.paint();
  assert.equal(p.lamp.attrs.get('aria-pressed'), 'false');
  assert.equal(p.meta.content, COLORS.blue);
  assert.equal(COLORS.blue, '#060a14');
  p.attrs.delete('data-gear');
  p.api.paint();
  assert.equal(p.lamp.attrs.get('aria-pressed'), 'true');
  assert.equal(p.meta.content, COLORS.light);
});

test('Tide\'s palette sets every token Gear Two sets, its text meets WCAG AA on its paper, and its paper is the theme colour', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'css', 'site.css'), 'utf8');
  const block = gear => Object.fromEntries([...css.match(new RegExp(`\\n:root\\[data-gear="${gear}"\\] \\{([^}]*)\\}`))[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  const two = block('two'), blue = block('blue');
  assert.deepEqual(Object.keys(blue).sort(), Object.keys(two).sort());
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const token of ['--ink', '--muted', '--accent']) assert.ok(ratio(blue[token], blue['--paper']) >= 4.5, `${token} ${blue[token]} on ${blue['--paper']}: ${ratio(blue[token], blue['--paper']).toFixed(2)}:1`);
  assert.equal(blue['--paper'], COLORS.blue);
  assert.equal(two['--paper'], COLORS.gear);
});
