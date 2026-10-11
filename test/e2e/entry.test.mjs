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
async function open(options = {}, route = '/') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage(), requests = [], errors = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site.origin + route);
  return { page, context, requests, errors };
}
async function shot(page, name) {
  if (!process.env.ENTRY_SHOTS) return;
  fs.mkdirSync(process.env.ENTRY_SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(process.env.ENTRY_SHOTS, name + '.png') });
}

test('Enter opens the portfolio once, defers the renderer, and restores usable focus', async () => {
  const { page, context, requests, errors } = await open();
  await page.locator('.entry[open]').waitFor();
  await page.waitForTimeout(500);
  assert.equal(requests.includes('/js/hero.js'), false);
  assert.equal(requests.includes('/assets/hero/hero.json'), false);
  assert.equal(await page.locator('[data-enter]').evaluate(el => el === document.activeElement), true);
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  assert.deepEqual(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({html:n.html, reason:n.failureSummary})) })), []);
  await shot(page, 'desktop-entry');
  await page.keyboard.press('Enter');
  await page.locator('.entry[open]').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#main').evaluate(el => el === document.activeElement), true);
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live') || document.querySelector('#figure').classList.contains('is-fallback'));
  assert.equal(requests.filter(p => p === '/js/hero.js').length, 1);
  await page.waitForTimeout(1100);
  await shot(page, 'desktop-home');
  await page.locator('[data-entry-replay]').click();
  await page.locator('.entry[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.entry[open]').waitFor({ state: 'hidden' });
  assert.equal(requests.filter(p => p === '/js/hero.js').length, 1, 'replay must not duplicate the renderer');
  await page.reload();
  assert.equal(await page.locator('.entry').isVisible(), false, 'return visits enter immediately');
  assert.deepEqual(errors, []);
  await context.close();
});

test('mobile entry fits the viewport, accepts touch, and preserves manual light mode', async () => {
  const { page, context, errors } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.locator('.entry[open]').waitFor();
  await page.waitForTimeout(700);
  await shot(page, 'mobile-entry');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const enter = await page.locator('[data-enter]').boundingBox();
  assert.ok(enter.y + enter.height <= 844);
  assert.ok(enter.x + enter.width <= 390, 'Enter must fit horizontally');
  await page.locator('[data-enter]').tap();
  await page.locator('.entry[open]').waitFor({ state: 'hidden' });
  await page.locator('[data-lamp]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
  await page.locator('[data-entry-replay]').click();
  await page.locator('.entry[open]').waitFor();
  assert.equal(await page.locator('.entry').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
  await shot(page, 'mobile-light-entry');
  await page.locator('[data-enter]').tap();
  await page.locator('.entry[open]').waitFor({ state: 'hidden' });
  await page.locator('#work-list').scrollIntoViewIfNeeded();
  await shot(page, 'mobile-work');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('reduced motion enters instantly and deep links bypass the entry and hero downloads', async () => {
  const { page, context, requests } = await open({ reducedMotion: 'reduce' });
  await page.locator('.entry[open]').waitFor();
  const animations = await page.locator('.entry').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
  assert.equal(animations, 0);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.entry').isVisible(), false);
  await context.close();
  const deep = await open({}, '/#work-list');
  await deep.page.waitForTimeout(2800);
  assert.equal(await deep.page.locator('.entry').isVisible(), false);
  assert.equal(deep.requests.includes('/js/hero.js'), false, 'direct work links should not initialize offscreen art');
  await deep.context.close();
});

test('blocked entry script and disabled JavaScript both leave the site navigable', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/js/entry.js', route => route.abort());
  await page.goto(site.origin);
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-entry'));
  assert.equal(await page.locator('.entry').isVisible(), false);
  assert.equal(await page.locator('a[href="#work-list"]').isVisible(), true);
  await context.close();
  const plain = await open({ javaScriptEnabled: false });
  assert.equal(await plain.page.locator('.entry').isVisible(), false);
  assert.equal(await plain.page.locator('a[href="#work-list"]').isVisible(), true);
  assert.equal(await plain.page.locator('.work-card.is-on a').isVisible(), true);
  await plain.context.close();
});

test('the entry stops drawing after exit and the sculpture stops offscreen or behind replay', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.drawCounts = { entry: 0, hero: 0 };
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.hasAttribute('data-entry-canvas')) window.drawCounts.entry++;
      return clear.apply(this, args);
    };
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      if (this.canvas.classList.contains('hero-dots')) window.drawCounts.hero++;
      return draw.apply(this, args);
    };
  });
  const page = await context.newPage();
  await page.goto(site.origin);
  await page.locator('.entry[open]').waitFor();
  const start = await page.evaluate(() => window.drawCounts.entry);
  await page.waitForTimeout(600);
  const frames = await page.evaluate(() => window.drawCounts.entry);
  assert.ok(frames - start > 0 && frames - start <= 21, 'entry should animate at no more than 30fps');
  const initialBytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((sum, r) => sum + r.decodedBodySize, 0));
  await page.keyboard.press('Enter');
  await page.locator('.entry[open]').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live'));
  const stopped = await page.evaluate(() => window.drawCounts.entry);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.drawCounts.entry), stopped);
  await page.locator('[data-entry-replay]').click();
  const frozen = await page.evaluate(() => window.drawCounts.hero);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.drawCounts.hero), frozen, 'the covered sculpture must pause');
  await page.keyboard.press('Escape');
  await page.locator('.entry[open]').waitFor({ state: 'hidden' });
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const offscreen = await page.evaluate(() => window.drawCounts.hero);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.drawCounts.hero), offscreen);
  console.log(`Entry resource bytes before renderer: ${initialBytes}; canvas frames over 600ms: ${frames - start}`);
  await context.close();
});
