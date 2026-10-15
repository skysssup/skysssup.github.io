import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

test('project evidence uses one media node, restores focus, and pauses for hidden, reduced, user, and example stops', { timeout: 60000 }, async () => {
  const site = await serve(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(site.origin + '/#agentcrucible');
    await page.locator('[data-studio].is-ready').waitFor();
    const image = page.locator('#project-agentcrucible [data-studio-evidence] img');
    await image.evaluate(img => img.decode());
    assert.ok(await image.evaluate(img => img.naturalWidth > 1000));
    assert.match(await page.locator('#project-agentcrucible figcaption').innerText(), /fictional demo workspace/);

    await page.locator('#airforge').click();
    await page.waitForFunction(() => SkyStudio.slug() === 'airforge');
    const video = page.locator('#project-airforge video');
    await video.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const node = document.querySelector('#project-airforge video');
      return node && !node.paused && node.currentTime > 0.1;
    });
    assert.equal(await page.locator('[data-studio-video]').evaluateAll(videos => videos.filter(node => !node.paused).length), 1);
    await video.evaluate(node => { window.galleryVideo = node; });
    const zoom = page.locator('[data-studio-evidence-zoom="airforge"]');
    await zoom.click();
    assert.equal(await page.locator('#studio-viewer video').evaluate(node => node === window.galleryVideo), true);
    assert.equal(await page.locator('#project-airforge video').count(), 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#studio-viewer').open);
    assert.equal(await page.locator('#project-airforge video').evaluate(node => node === window.galleryVideo), true);
    assert.equal(await zoom.evaluate(button => button === document.activeElement), true);
    await page.waitForFunction(() => !window.galleryVideo.paused);

    await video.evaluate(node => node.pause());
    await page.waitForTimeout(200);
    assert.equal(await video.evaluate(node => node.paused), true, 'a user pause stays paused');
    await video.evaluate(node => node.play());
    await page.waitForFunction(() => !window.galleryVideo.paused);

    await page.locator('[data-motion-toggle]').click();
    await page.waitForFunction(() => window.galleryVideo.paused && document.documentElement.getAttribute('data-motion') === 'reduced');
    await page.locator('[data-motion-toggle]').click();
    await page.waitForFunction(() => !window.galleryVideo.paused && !document.documentElement.hasAttribute('data-motion'));

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.galleryVideo.paused);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => !window.galleryVideo.paused);

    await page.locator('[data-bench-live]').click();
    await page.waitForFunction(() => window.galleryVideo.paused && document.querySelector('[data-bench-live]').getAttribute('aria-pressed') === 'false');
    await page.locator('[data-bench-live]').click();
    await page.waitForFunction(() => !window.galleryVideo.paused);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => window.galleryVideo.paused, null, { timeout: 4000 });
    await video.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !window.galleryVideo.paused);

    await page.locator('#shipgate').click();
    await page.waitForFunction(() => SkyStudio.slug() === 'shipgate');
    await page.waitForFunction(() => {
      const videos = [...document.querySelectorAll('[data-studio-video]')];
      return videos.filter(node => !node.paused).every(node => node.closest('#project-shipgate'))
        && videos.filter(node => node.closest('#project-airforge')).every(node => node.paused);
    });
    assert.deepEqual(errors, []);
  } finally {
    await context.close(); await browser.close(); site.server.close();
  }
});
