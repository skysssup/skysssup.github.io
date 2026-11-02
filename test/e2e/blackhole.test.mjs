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

test('home plays a short black-hole entrance without gating the hero or scroll', async () => {
  const timings = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [], art = [];
    // Observe the short-lived entrance from document creation: a cold WebGL
    // startup can consume its lifetime before DOMContentLoaded reaches the driver.
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const canvas = document.querySelector('.blackhole-transition');
        if (canvas && !window.__entranceObserved) window.__entranceObserved = {
          active: window.SkyBlackHole.active,
          overflow: getComputedStyle(document.body).overflow,
          pe: getComputedStyle(canvas).pointerEvents,
        };
      }).observe(document, { childList: true, subtree: true });
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/assets/hero/hero.json')) art.push(r.url()); });
    const started = Date.now();
    await page.goto(site.origin + (width === 1440 ? '/#about' : '/#hero'), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__entranceObserved);
    assert.equal(await page.locator('[data-enter], [data-entry-screen], [data-entry-replay]').count(), 0);
    assert.ok(art.length >= 1, 'hero art is requested while the entrance plays');
    await page.waitForFunction(() => {
      const figure = document.querySelector('#figure');
      return figure && (figure.classList.contains('is-live') || figure.classList.contains('is-fallback'));
    });
    const during = await page.evaluate(() => window.__entranceObserved);
    assert.equal(during.active, true);
    assert.equal(during.pe, 'none');
    assert.notEqual(during.overflow, 'hidden');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Work', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.blackhole-transition') && window.SkyBlackHole.active === false);
    await ready(page);
    await page.waitForFunction(() => window.SkyStudio.settled() && window.SkyStudio.slug() === 'agentcrucible' && window.SkyStudio.selected() === 1);
    timings.push({ width, ms: Date.now() - started, skipped: true });
    const api = await page.evaluate(() => ({
      keys: Object.keys(window.SkyStudio).sort(),
      globals: {
        blackhole: typeof window.SkyBlackHole,
        workbench: typeof window.SkyWorkbench,
        presence: typeof window.SkyPresence,
        field: typeof window.SkyScrollField,
      },
      scroll: document.documentElement.scrollWidth <= innerWidth,
    }));
    assert.deepEqual(api.keys, ['playing', 'position', 'select', 'selectSlug', 'selected', 'settled', 'slug', 'snapshot', 'wheel']);
    assert.deepEqual(api.globals, { blackhole: 'object', workbench: 'undefined', presence: 'undefined', field: 'undefined' });
    assert.equal(api.scroll, true);
    assert.equal(await page.locator('#figure').count(), 1);
    assert.equal(await page.locator('[data-studio-pick]').count(), 3);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('.blackhole-transition') && !window.__entranceSeen) {
        window.__entranceSeen = true;
        window.__entranceStarted = performance.now();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(site.origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('.blackhole-transition'));
  const played = await page.evaluate(() => new Promise((resolve) => {
    const t0 = window.__entranceStarted;
    const tick = () => {
      const node = document.querySelector('.blackhole-transition');
      if (!node && window.SkyBlackHole && window.SkyBlackHole.active === false) resolve(performance.now() - t0);
      else requestAnimationFrame(tick);
    };
    tick();
  }));
  timings.push({ width: 1280, ms: Math.round(played), skipped: false });
  assert.ok(played >= 1200 && played <= 4000, 'entrance settles in a short window, measured ' + played);
  assert.equal(await page.locator('.blackhole-transition').count(), 0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__entranceSeen === true);
  await context.close();
  console.log('BLACKHOLE_TIMING ' + JSON.stringify(timings));
});

test('input, reduced motion, project hashes, and other routes skip the entrance cleanly', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto(site.origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('.blackhole-transition'));
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 180);
  await page.waitForFunction(() => !document.querySelector('.blackhole-transition'));
  await page.waitForTimeout(200);
  const afterY = await page.evaluate(() => scrollY);
  assert.ok(afterY > before, 'wheel still scrolls');
  await context.close();

  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(site.origin + '/', { waitUntil: 'domcontentloaded' });
  await ready(reducedPage);
  assert.equal(await reducedPage.locator('.blackhole-transition').count(), 0);
  assert.equal(await reducedPage.evaluate(() => window.SkyBlackHole.active), false);
  assert.equal(await reducedPage.getAttribute('html', 'data-motion'), 'reduced');
  await reduced.close();

  for (const entry of [
    { suffix: '/#work-list', slug: 'agentcrucible', article: '#project-agentcrucible' },
    { suffix: '/#agentcrucible', hash: '#project-agentcrucible', slug: 'agentcrucible', article: '#project-agentcrucible' },
    { suffix: '/#contact', slug: 'contact', article: '#contact' },
  ]) {
    const hashContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
    const hashPage = await hashContext.newPage();
    await hashPage.goto(site.origin + entry.suffix, { waitUntil: 'domcontentloaded' });
    assert.equal(await hashPage.locator('.blackhole-transition').count(), 0);
    await hashPage.waitForFunction(expected => {
      if (!window.SkyStudio?.settled()) return false;
      const header = document.querySelector('.studio-header').getBoundingClientRect().bottom;
      const node = document.querySelector(expected.article);
      if (!node) return false;
      const top = node.getBoundingClientRect().top;
      const clear = top >= header - 2 && top < innerHeight;
      if (!expected.slug) {
        const selected = document.querySelector('[data-studio-pick][aria-selected="true"]');
        const about = document.getElementById('about');
        return scrollY <= 2 && !!about && !selected && window.SkyStudio.slug() === 'about' && top < innerHeight;
      }
      if (expected.slug === 'contact') return clear && window.SkyStudio.slug() === 'contact';
      return clear && window.SkyStudio.slug() === expected.slug && document.getElementById(expected.slug).getAttribute('aria-selected') === 'true' && document.getElementById(`project-${expected.slug}`).classList.contains('is-shown');
    }, entry);
    const hash = entry.hash || entry.suffix.slice(entry.suffix.indexOf('#'));
    assert.equal(new URL(hashPage.url()).hash, hash);
    assert.equal(await hashPage.locator('.blackhole-transition').count(), 0);
    await hashContext.close();
  }

  const work = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const workPage = await work.newPage();
  await workPage.goto(site.origin + '/work/', { waitUntil: 'domcontentloaded' });
  assert.equal(await workPage.locator('.blackhole-transition').count(), 0);
  assert.equal(await workPage.evaluate(() => typeof window.SkyBlackHole), 'undefined');
  await work.close();
});

test('a background home waits until visible before playing its entrance', async () => {
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__background = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__background });
    });
    await page.goto(site.origin + '/#about', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('.blackhole-transition').count(), 0);
    await page.evaluate(() => {
      window.__background = false;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('.blackhole-transition').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.blackhole-transition').count(), 0);
  } finally { await context.close(); }
});
