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

test('the contact dial knows my minute of the day, what I am probably doing, and how far ahead of you I am', () => {
  assert.equal(page.kathmanduMinute(new Date('2026-10-04T20:30:00Z')), 2 * 60 + 15);
  assert.equal(page.kathmanduMinute(new Date('2026-10-04T18:15:00Z')), 0);
  assert.equal(page.kathmanduStatus(0), 'asleep');
  assert.equal(page.kathmanduStatus(10 * 60), 'eating dal bhat');
  assert.equal(page.kathmanduStatus(23 * 60 + 59), 'debugging something');
  assert.equal(page.timeGap(345), 'the same time as you');
  assert.equal(page.timeGap(-240), '9 h 45 min ahead of you');
  assert.equal(page.timeGap(330), '15 min ahead of you');
  assert.equal(page.timeGap(405), '1 h behind you');
});

test('the dial stipples the night between a sunrise and sunset worked out for the day', () => {
  const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;
  const october = page.sunTimes(new Date(Date.UTC(2026, 9, 4, 6)));
  assert.deepEqual([clock(october.rise), clock(october.set)], ['05:57', '17:48']);
  const june = page.sunTimes(new Date(Date.UTC(2026, 5, 21, 6)));
  assert.ok(june.set - june.rise > october.set - october.rise, 'longer days in June');
  assert.equal(page.darkness(12 * 60, october), 0);
  assert.equal(page.darkness(0, october), 1);
  assert.equal(page.darkness(october.rise, october), 0.5);
});

test('the construction grid names each size by its role in the spec', () => {
  assert.equal(page.typeRole(18, 24, false), 'Title S');
  assert.equal(page.typeRole(10, 16, true), 'Label');
  assert.equal(page.typeRole(13, 20, true), 'Small, mono');
  assert.equal(page.typeRole(17, 22, false), '17/22');
});
