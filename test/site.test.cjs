const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../site.js'), 'utf8');
function page({ saved = null, dark = false, blocked = false, legacy = false } = {}) {
  const attrs = new Map();
  const listeners = {};
  const label = { textContent: '' };
  const button = { label, attrs: new Map(), getAttribute(k) { return this.attrs.get(k); }, setAttribute(k,v) { this.attrs.set(k,v); }, addEventListener(k,f) { listeners[k] = f; }, querySelector: () => label };
  const root = { getAttribute: k => attrs.get(k), setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k) };
  const meta = { setAttribute(k,v) { this[k] = v; } };
  const mq = { matches: dark };
  if (legacy) mq.addListener = f => { listeners.scheme = f; };
  else mq.addEventListener = (k,f) => { listeners.scheme = f; };
  const storage = { getItem() { if (blocked) throw new Error('blocked'); return saved; }, setItem(k,v) { if (blocked) throw new Error('blocked'); saved = v; } };
  const window = { matchMedia: () => mq, addEventListener: (k,f) => { listeners[k] = f; } };
  vm.runInNewContext(source, { document: { documentElement: root, getElementById: () => button, querySelector: () => meta }, localStorage: storage, window });
  return { attrs, button, meta, mq, listeners, window, changeSaved: v => { saved = v; } };
}
test('follows OS changes without an explicit selection', () => {
  const p = page();
  assert.equal(p.button.attrs.get('aria-pressed'), 'false');
  p.mq.matches = true;
  p.listeners.scheme();
  assert.equal(p.button.label.textContent, 'LIGHTS OFF');
  assert.equal(p.meta.content, '#0b0b0c');
});
test('preserves a user selection across OS changes when storage is blocked', () => {
  const p = page({ blocked: true });
  p.listeners.click();
  p.mq.matches = false;
  p.listeners.scheme();
  assert.equal(p.attrs.get('data-theme'), 'dark');
  assert.equal(p.button.attrs.get('aria-pressed'), 'true');
});
test('saved light preference overrides a dark OS', () => {
  const p = page({ saved: 'light', dark: true });
  assert.equal(p.button.label.textContent, 'LIGHTS ON');
  assert.equal(p.meta.content, '#ffffff');
});
test('synchronizes theme changes and resets from other tabs', () => {
  const p = page({ saved: 'dark' });
  p.changeSaved('light');
  p.listeners.storage({ key: 'sky-theme' });
  assert.equal(p.attrs.get('data-theme'), 'light');
  p.changeSaved(null);
  p.mq.matches = true;
  p.listeners.storage({ key: null });
  assert.equal(p.attrs.has('data-theme'), false);
  assert.equal(p.button.attrs.get('aria-pressed'), 'true');
});
test('ignores unrelated storage updates', () => {
  const p = page({ saved: 'dark' });
  p.changeSaved('light');
  p.listeners.storage({ key: 'other' });
  assert.equal(p.attrs.get('data-theme'), 'dark');
});
test('ignores invalid saved preferences and supports legacy media listeners', () => {
  const p = page({ saved: 'invalid', legacy: true });
  assert.equal(p.attrs.has('data-theme'), false);
  p.mq.matches = true;
  p.listeners.scheme();
  assert.equal(p.button.attrs.get('aria-pressed'), 'true');
});
test('Gear Two reads as lights off and an installed transition decides the next theme', () => {
  const p = page();
  p.attrs.set('data-gear', 'two');
  p.listeners.storage({ key: 'sky-theme' });
  assert.equal(p.button.label.textContent, 'LIGHTS OFF');
  assert.equal(p.meta.content, '#090909');
  let seen = null;
  p.window.skyThemeTransition = (apply, current) => { seen = current; apply('light'); };
  p.listeners.click();
  assert.equal(seen, 'light');
  assert.equal(p.attrs.get('data-theme'), 'light');
});
