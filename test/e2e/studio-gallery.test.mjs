import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

async function idle(page) {
  await page.waitForFunction(() => window.SkyStudio?.settled() && !document.documentElement.classList.contains('lenis-scrolling'));
}

test('three project articles stay in the document and only the active viewport plays', { timeout: 60000 }, async () => {
  const site = await serve(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(site.origin + '/');
    await page.locator('[data-studio].is-ready').waitFor();
    await idle(page);
    const parked = await page.evaluate(() => {
      const articles = [...document.querySelectorAll('article.work-card')];
      return {
        ids: articles.map(node => node.id),
        inert: articles.every(node => node.inert === false),
        inDetail: articles.every(node => node.closest('[data-studio-detail]')),
        media: articles.map(node => node.querySelector('[data-studio-evidence] img, [data-studio-evidence] video')?.tagName || ''),
      };
    });
    assert.deepEqual(parked.ids, ['project-agentcrucible', 'project-airforge', 'project-shipgate']);
    assert.equal(parked.inert, true);
    assert.equal(parked.inDetail, true);
    assert.deepEqual(parked.media, ['IMG', 'VIDEO', 'VIDEO']);
    const image = page.locator('#project-agentcrucible [data-studio-evidence] img');
    await image.evaluate(img => img.decode());
    assert.ok(await image.evaluate(img => img.naturalWidth > 1000));
    assert.match(await page.locator('#project-agentcrucible figcaption').innerText(), /fictional demo workspace/);

    await page.locator('#airforge').click();
    await idle(page);
    await page.waitForFunction(() => {
      const air = document.querySelector('#project-airforge video');
      const ship = document.querySelector('#project-shipgate video');
      const box = document.getElementById('project-airforge').getBoundingClientRect();
      return window.SkyStudio.slug() === 'airforge'
        && document.getElementById('project-airforge').classList.contains('is-shown')
        && !document.getElementById('project-agentcrucible').classList.contains('is-shown')
        && !document.getElementById('project-shipgate').classList.contains('is-shown')
        && box.top < innerHeight && box.bottom > 0
        && air && !air.paused && air.currentTime > 0.1
        && ship && ship.paused;
    });
    assert.equal(await page.locator('article.work-card').count(), 3);

    await page.locator('#shipgate').click();
    await idle(page);
    await page.waitForFunction(() => {
      const air = document.querySelector('#project-airforge video');
      const ship = document.querySelector('#project-shipgate video');
      const box = document.getElementById('project-shipgate').getBoundingClientRect();
      return window.SkyStudio.slug() === 'shipgate'
        && document.getElementById('project-shipgate').classList.contains('is-shown')
        && box.top < innerHeight && box.bottom > 0
        && ship && !ship.paused && ship.currentTime > 0.1
        && air && air.paused
        && document.querySelectorAll('article.work-card').length === 3;
    });
    assert.deepEqual(errors, []);
  } finally {
    await context.close(); await browser.close(); site.server.close();
  }
});
