import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

test('project evidence preserves playback and pauses when hidden, reduced, or replaced', { timeout: 60000 }, async () => {
  const site = await serve(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(site.origin + '/#agentcrucible');
    await page.locator('[data-studio].is-ready').waitFor();
    const image = page.locator('#project-agentcrucible [data-studio-evidence] img');
    await image.evaluate(img => img.decode());
    assert.ok(await image.evaluate(img => img.naturalWidth > 1000));
    assert.match(await page.locator('[data-studio-gallery-caption]').first().innerText(), /fictional demo workspace/);
    await page.locator('#studio-pick-airforge').click();
    await page.waitForFunction(() => SkyStudio.slug() === 'airforge' && SkyStudio.settled());
    const video = page.locator('#project-airforge video');
    await page.waitForFunction(() => {
      const v = document.querySelector('#project-airforge video');
      return !v.paused && v.currentTime > .1;
    });
    assert.equal(await page.locator('[data-studio-video]').evaluateAll(videos => videos.filter(v => !v.paused).length), 1);
    await video.evaluate(v => { window.galleryVideo = v; });
    await page.locator('[data-studio-evidence-zoom="airforge"]').click();
    assert.equal(await page.locator('#studio-viewer video').evaluate(v => v === window.galleryVideo), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#studio-viewer').open);
    assert.equal(await video.evaluate(v => v === window.galleryVideo), true);
    assert.equal(await page.locator('[data-studio-evidence-zoom="airforge"]').evaluate(b => b === document.activeElement), true);
    await page.locator('#project-airforge [data-studio-view-pick="illustration"]').click();
    await page.waitForFunction(() => window.galleryVideo.paused);
    assert.equal(await page.locator('#project-airforge .scene-drawing').isVisible(), true);
    await page.locator('#project-airforge [data-studio-view-pick="evidence"]').click();
    await page.waitForFunction(() => !window.galleryVideo.paused);
    await page.locator('[data-motion-toggle]').click();
    await page.waitForFunction(() => window.galleryVideo.paused);
    await page.locator('[data-motion-toggle]').click();
    await page.waitForFunction(() => !window.galleryVideo.paused);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.galleryVideo.paused);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => !window.galleryVideo.paused);
    await page.locator('#studio-pick-about').click();
    await page.waitForFunction(() => SkyStudio.settled() && SkyStudio.slug() === 'about');
    assert.equal(await page.locator('[data-studio-video]').evaluateAll(videos => videos.every(v => v.paused)), true);
    assert.deepEqual(errors, []);
  } finally {
    await context.close(); await browser.close(); site.server.close();
  }
});
