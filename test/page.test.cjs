const { test } = require('node:test');
const assert = require('node:assert/strict');
const page = require('../js/page.js');

test('a theme filter shows only the projects that carry it', () => {
  const rows = [['ai-systems'], ['physics-software'], ['developer-tools', 'ai-systems'], ['developer-tools']];
  assert.deepEqual(page.filterRows(rows, 'ai-systems').shown, [true, false, true, false]);
  assert.deepEqual(page.filterRows(rows, 'developer-tools').shown, [false, false, true, true]);
  assert.deepEqual(page.filterRows(rows, 'all').shown, [true, true, true, true]);
  const unknown = page.filterRows(rows, 'blockchain');
  assert.equal(unknown.theme, 'all');
  assert.deepEqual(unknown.shown, [true, true, true, true]);
});

test('the filter round-trips through the URL', () => {
  assert.equal(page.themeFromSearch('?theme=physics-software'), 'physics-software');
  assert.equal(page.themeFromSearch('?x=1&theme=ai-systems'), 'ai-systems');
  assert.equal(page.themeFromSearch('?theme=%3Cscript%3E'), 'all');
  assert.equal(page.themeFromSearch(''), 'all');
  for (const theme of page.THEMES) assert.equal(page.themeFromSearch(page.searchFor(theme)), theme);
  assert.equal(page.searchFor('all'), '');
});

test('the section index marks the last section whose top has passed the reading line', () => {
  assert.equal(page.activeSection([100, 600, 1200], 300), 0);
  assert.equal(page.activeSection([-900, -100, 400], 300), 1);
  assert.equal(page.activeSection([-2000, -1500, -900], 300), 2);
  assert.equal(page.activeSection([500, 900], 300), 0);
});

test('local time is Kathmandu time, UTC+5:45', () => {
  assert.equal(page.kathmanduTime(new Date('2026-10-04T00:00:00Z')), '05:45');
  assert.equal(page.kathmanduTime(new Date('2026-10-04T18:30:00Z')), '00:15');
});
