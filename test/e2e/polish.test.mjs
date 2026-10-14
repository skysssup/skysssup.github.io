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
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-phase'));
  assert.equal(await page.locator('html').getAttribute('data-phase'), null);
  await page.locator('.fx-ring').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.fx-ring, .ember-trail').count(), 0);
  await page.locator('[data-lamp]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the actual homepage retains the original light sweep, lightning, full resolution, and ember trail', async () => {
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
  await context.addInitScript(() => {
      sessionStorage.setItem('sky-intro', 'seen');
      const probe = window.avatarEffects = { sweep: false, strike: false, bolt: false, dpr: 0, pointerPush: 0, emberAlpha: 0 };
      const locations = new WeakMap(), gl = WebGL2RenderingContext.prototype;
      const locate = gl.getUniformLocation;
      gl.getUniformLocation = function (program, name) {
        const result = locate.call(this, program, name);
        if (result) locations.set(result, name);
        return result;
      };
      for (const method of ['uniform1f', 'uniform1i', 'uniform4f']) {
        const original = gl[method];
        gl[method] = function (at, ...values) {
          if (this.canvas.classList.contains('hero-dots')) {
            const name = locations.get(at);
            if (name === 'u_sheen' && values[1]) probe.sweep = true;
            if (name === 'u_strikes' && values[0] > 0) probe.strike = true;
            if (name === 'u_dpr') probe.dpr = values[0];
            if (name === 'u_pointer') probe.pointerPush = Math.max(probe.pointerPush, values[2]);
          }
          return original.call(this, at, ...values);
        };
      }
      const stroke = CanvasRenderingContext2D.prototype.stroke;
      CanvasRenderingContext2D.prototype.stroke = function (...args) {
        if (this.canvas.classList.contains('hero-words') && this.lineWidth >= 4) probe.bolt = true;
        return stroke.apply(this, args);
      };
    });
    const page = await context.newPage();
    try {
    await page.goto(site.origin);
    await page.locator('#figure.is-live').waitFor();
    await page.waitForFunction(() => window.avatarEffects.sweep, null, { timeout: 18000 });
    assert.equal(await page.evaluate(() => window.avatarEffects.dpr), 2, 'retain the original high-density raster');
    await page.locator('[data-gear-toggle]').click();
    await page.waitForFunction(() => window.avatarEffects.strike && window.avatarEffects.bolt);
    assert.equal(await page.locator('.hero-words').isVisible(), true, 'the actual lightning overlay is visible');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-phase'));
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas.fx-embers');
      return canvas && !canvas.hidden && canvas.width > 0 && canvas.height > 0;
    });
    // Sparks live under a second, then drift() clears their dirty rect. A read after a fixed sleep sees a blank
    // bitmap. A read inside fill() also stalls the main thread, and the browser then coalesces the stepped moves
    // into one jump of 320px or more, which sheds no embers. Deliver each short native move, let that move's
    // animation frame paint, and keep the hottest alpha from the bitmap itself.
    let x = 300, y = 220;
    await page.mouse.move(x, y);
    for (let step = 1; step <= 36; step++) {
      const nextX = 300 + 340 * step / 36;
      const nextY = 220 + 100 * step / 36;
      await page.mouse.move(nextX, nextY);
      await page.evaluate(({ x0, y0, x1, y1 }) => new Promise(resolve => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector('canvas.fx-embers');
          const probe = window.avatarEffects;
          if (canvas && !canvas.hidden && canvas.width && canvas.height) {
            const ctx = canvas.getContext('2d');
            const m = ctx.getTransform();
            const scaleX = Math.hypot(m.a, m.b) || 1;
            const scaleY = Math.hypot(m.c, m.d) || 1;
            const pad = 36;
            const left = Math.max(0, Math.floor((Math.min(x0, x1) - pad) * scaleX + m.e));
            const top = Math.max(0, Math.floor((Math.min(y0, y1) - pad) * scaleY + m.f));
            const right = Math.min(canvas.width, Math.ceil((Math.max(x0, x1) + pad) * scaleX + m.e));
            const bottom = Math.min(canvas.height, Math.ceil((Math.max(y0, y1) + pad) * scaleY + m.f));
            if (right > left && bottom > top) {
              const data = ctx.getImageData(left, top, right - left, bottom - top).data;
              for (let i = 3; i < data.length; i += 4) if (data[i] > probe.emberAlpha) probe.emberAlpha = data[i];
            }
          }
          resolve(probe.emberAlpha);
        });
      }), { x0: x, y0: y, x1: nextX, y1: nextY });
      x = nextX;
      y = nextY;
    }
    await page.locator('.fx-ember.is-on').waitFor({ state: 'attached' });
    const emberAlpha = await page.evaluate(() => window.avatarEffects.emberAlpha);
    console.log(`ember trail peak alpha ${emberAlpha}`);
    assert.equal(emberAlpha > 0, true, 'the original ember trail draws visible sparks');
    assert.equal(await page.evaluate(() => window.avatarEffects.pointerPush), 0, 'restoring effects does not restore cursor distortion');
    await page.locator('[data-motion-toggle]').click();
    assert.equal(await page.locator('.fx-embers').isVisible(), false);
    assert.equal(await page.locator('html').getAttribute('data-phase'), null);
  } finally { await context.close(); }
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
