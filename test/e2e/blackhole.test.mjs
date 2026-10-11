import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let browser, site;
before(async () => { site = await serve(root); browser = await chromium.launch({ channel: 'chrome' }); });
after(async () => { await browser?.close(); site?.server.close(); });

test('only the black-hole animation plays automatically, then leaves the original page usable', async () => {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700 });
    const page = await context.newPage(), errors = [], art = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/assets/hero/hero.json')) art.push(r.url()); });
    await page.goto(site.origin, { waitUntil: 'domcontentloaded' });
    const overlay = page.locator('.blackhole-transition');
    assert.equal(await overlay.count(), 1);
    assert.equal(await page.locator('[data-enter], [data-entry-screen], [data-entry-replay]').count(), 0);
    assert.equal(art.length, 0, 'heavy art must wait for the short transition');
    assert.equal(await overlay.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    await page.waitForTimeout(450);
    if (process.env.BLACKHOLE_SHOTS) {
      fs.mkdirSync(process.env.BLACKHOLE_SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.BLACKHOLE_SHOTS, `blackhole-${width}.png`) });
    }
    await overlay.waitFor({ state: 'detached', timeout: 3000 });
    assert.equal(await page.evaluate(() => window.SkyBlackHole.active), false);
    await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live') || document.querySelector('#figure').classList.contains('is-fallback'));
    assert.equal(await page.locator('#figure').getAttribute('data-intro'), null, 'do not chain the old automatic gear intro');
    await page.locator('#work-list').scrollIntoViewIfNeeded();
    await page.locator('[data-work-link]').first().focus();
    assert.equal(await page.locator('.work-card.is-on h3').innerText(), 'AgentCrucible');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('input skips the effect immediately; reduced motion and deep links skip it entirely', async () => {
  for (const key of ['Escape', 'Tab']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(site.origin, { waitUntil: 'domcontentloaded' });
    await page.keyboard.press(key);
    assert.equal(await page.locator('.blackhole-transition').count(), 0);
    await context.close();
  }
  for (const [options, suffix] of [[{ reducedMotion: 'reduce' }, '/'], [{}, '/#work-list']]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto(site.origin + suffix);
    assert.equal(await page.locator('.blackhole-transition').count(), 0);
    assert.equal(await page.locator('[data-enter]').count(), 0);
    await context.close();
  }
});
