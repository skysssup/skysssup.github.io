import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let browser, site;
before(async () => { site = await serve(root); browser = await chromium.launch({ channel: 'chrome' }); });
after(async () => { await browser?.close(); site?.server.close(); });

test('the main avatar stays large and animates without pointer distortion', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.portraitDraws = 0;
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      if (this.canvas.classList.contains('hero-dots')) window.portraitDraws++;
      return draw.apply(this, args);
    };
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(site.origin);
  await page.locator('#figure.is-live').waitFor();
  await page.waitForTimeout(700);
  const figure = page.locator('#figure');
  const bounds = await figure.boundingBox(), draws = await page.evaluate(() => window.portraitDraws);
  const before = await figure.screenshot();
  assert.ok(bounds.width > 600, 'the main portrait must remain prominent');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .7, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(1300);
  assert.notDeepEqual(await figure.screenshot(), before, 'the portrait must retain its ambient movement');
  assert.ok(await page.evaluate(() => window.portraitDraws) > draws, 'the visible portrait keeps animating');
  assert.equal(await figure.evaluate(el => getComputedStyle(el).cursor), 'default');
  if (process.env.CRAFT_SHOTS) {
    fs.mkdirSync(process.env.CRAFT_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.CRAFT_SHOTS, 'hero-desktop.png') });
  }
  assert.equal(await page.locator('.fig-note, .essentially, [data-hero-telemetry], [data-enter]').count(), 0);
  await page.locator('[data-gear-toggle]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-gear') === 'two');
  assert.equal(await page.locator('html').getAttribute('data-phase'), null);
  assert.equal(await page.locator('.fx-ring, .ember-trail').count(), 0);
  await page.locator('[data-lamp]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
  assert.deepEqual(errors, []);
  await context.close();
});

test('polished homepage fits desktop and mobile, keeps text work and keyboard navigation accessible', async () => {
  for (const width of [1440, 768, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(site.origin);
    await page.locator('#figure.is-live').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('.workbench img').count(), 0);
    if (process.env.POLISH_SHOTS) {
      fs.mkdirSync(process.env.POLISH_SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.POLISH_SHOTS, `home-${width}.png`), fullPage: true });
    }
    const first = page.locator('[data-work-pick]').first();
    await first.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.work-card.is-on h3').innerText(), 'AirForge');
    const a11y = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(a11y.violations.map(v => v.id), []);
    await page.locator('.work-card.is-on .scene-links a').first().click();
    await page.waitForURL('**/work/airforge/');
    assert.equal(await page.locator('h1').innerText(), 'AirForge');
    await context.close();
  }
});
