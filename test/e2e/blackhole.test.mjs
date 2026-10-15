import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let browser, site;
before(async () => { site = await serve(root); browser = await chromium.launch({ channel: 'chrome' }); });
after(async () => { await browser?.close(); site?.server.close(); });

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('[data-studio]')?.classList.contains('is-ready') && window.SkyStudio?.settled());
}

test('the studio is usable immediately, with no black-hole gate and no dead loading screen', async () => {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700 });
    const page = await context.newPage(), errors = [], art = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/assets/hero/hero.json')) art.push(r.url()); });
    await page.goto(site.origin, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('.blackhole-transition, [data-enter], [data-entry-screen], [data-entry-replay]').count(), 0);
    await ready(page);
    assert.equal(await page.locator('.blackhole-transition, [data-enter], [data-entry-screen], [data-entry-replay]').count(), 0);
    assert.ok(art.length >= 1, 'hero art is requested with the page, not held behind a gate');
    await page.waitForFunction(() => {
      const figure = document.querySelector('#figure');
      return figure && (figure.classList.contains('is-live') || figure.classList.contains('is-fallback'));
    });
    assert.equal(await page.locator('#figure').getAttribute('data-intro'), null);
    assert.equal(await page.getAttribute('html', 'data-theme'), null, 'dark is the default until light is chosen');
    const api = await page.evaluate(() => ({
      keys: Object.keys(window.SkyStudio).sort(),
      globals: {
        blackhole: typeof window.SkyBlackHole,
        workbench: typeof window.SkyWorkbench,
        presence: typeof window.SkyPresence,
        field: typeof window.SkyScrollField,
      },
      overflow: getComputedStyle(document.body).overflow,
      scroll: document.documentElement.scrollWidth <= innerWidth,
    }));
    assert.deepEqual(api.keys, ['playing', 'position', 'select', 'selectSlug', 'selected', 'settled', 'slug', 'snapshot', 'wheel']);
    assert.deepEqual(api.globals, { blackhole: 'undefined', workbench: 'undefined', presence: 'undefined', field: 'undefined' });
    assert.equal(api.overflow, 'hidden');
    assert.equal(api.scroll, true);
    assert.equal(await page.locator('[data-scroll-field], .scroll-waypoints').count(), 0);
    await page.evaluate(() => window.SkyStudio.selectSlug('agentcrucible'));
    await page.waitForFunction(() => window.SkyStudio.settled() && window.SkyStudio.slug() === 'agentcrucible' && window.SkyStudio.selected() === 1);
    const snap = await page.evaluate(() => window.SkyStudio.snapshot());
    assert.equal(snap.slug, 'agentcrucible');
    assert.equal(snap.selected, 1);
    assert.equal(await page.locator('#studio-pick-agentcrucible').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('[data-studio-pick][aria-selected="true"]').count(), 1);
    assert.equal(await page.locator('[data-studio-panel="agentcrucible"]').evaluate(el => el.classList.contains('is-current') && !el.inert), true);
    assert.equal(await page.locator('[data-studio-panel]:not(.is-current)').evaluateAll(els => els.every(el => el.inert)), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('keyboard, reduced motion, hashes, and reload never insert a gate and keep the studio contract', async () => {
  for (const key of ['Escape', 'Tab']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(site.origin, { waitUntil: 'domcontentloaded' });
    await page.keyboard.press(key);
    assert.equal(await page.locator('.blackhole-transition, [data-enter]').count(), 0);
    await ready(page);
    assert.equal(await page.locator('.blackhole-transition, [data-enter]').count(), 0);
    assert.equal(await page.evaluate(() => window.SkyStudio.slug()), 'about');
    await context.close();
  }

  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(site.origin + '/', { waitUntil: 'domcontentloaded' });
  await ready(reducedPage);
  assert.equal(await reducedPage.locator('.blackhole-transition, [data-enter]').count(), 0);
  assert.equal(await reducedPage.getAttribute('html', 'data-motion'), 'reduced');
  await reducedPage.locator('[data-studio-pick][aria-selected="true"]').focus();
  await reducedPage.keyboard.press('ArrowDown');
  await reducedPage.waitForFunction(() => window.SkyStudio.settled() && window.SkyStudio.slug() === 'agentcrucible');
  assert.equal(await reducedPage.locator('.blackhole-transition').count(), 0);
  await reducedPage.locator('[data-studio-step="1"]').click();
  await reducedPage.waitForFunction(() => window.SkyStudio.settled() && window.SkyStudio.slug() === 'airforge' && window.SkyStudio.selected() === 2);
  await reducedPage.locator('[data-studio-step="-1"]').click();
  await reducedPage.waitForFunction(() => window.SkyStudio.settled() && window.SkyStudio.slug() === 'agentcrucible');
  assert.equal(await reducedPage.locator('#studio-pick-agentcrucible').getAttribute('role'), 'option');
  assert.equal(await reducedPage.locator('.blackhole-transition, [data-enter]').count(), 0);
  await reduced.close();

  for (const [suffix, slug] of [['/#hero', 'about'], ['/#about', 'about'], ['/#work-list', 'agentcrucible'], ['/#agentcrucible', 'agentcrucible'], ['/#contact', 'contact']]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(site.origin + suffix, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expected => window.SkyStudio?.settled() && window.SkyStudio.slug() === expected, slug);
    assert.equal(await page.locator('.blackhole-transition, [data-enter], [data-entry-screen]').count(), 0);
    assert.equal(await page.locator(`[data-studio-panel="${slug}"]`).evaluate(el => el.classList.contains('is-current')), true);
    assert.equal(await page.locator(`#studio-pick-${slug}`).getAttribute('aria-selected'), 'true');
    const hash = suffix.slice(suffix.indexOf('#'));
    assert.equal(new URL(page.url()).hash, hash);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expected => window.SkyStudio?.settled() && window.SkyStudio.slug() === expected, slug);
    assert.equal(new URL(page.url()).hash, hash);
    assert.equal(await page.locator('.blackhole-transition, [data-enter]').count(), 0);
    await context.close();
  }
});
