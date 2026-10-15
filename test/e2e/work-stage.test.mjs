import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECTS = ['agentcrucible', 'airforge', 'shipgate', 'recall-ai', 'spanforge', 'localpulse', 'ghost-notetaker', 'moltdao'];
let browser, site;
before(async () => { site = await serve(root); browser = await chromium.launch({ channel: 'chrome' }); });
after(async () => { await browser?.close(); site?.server.close(); });

async function open(options = {}) {
  const { url = '/#about', hookHero = false, javaScriptEnabled = true, ...rest } = options;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled, ...rest });
  if (hookHero) {
    await context.addInitScript(() => {
      window.portraitDraws = 0;
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas && this.canvas.classList && this.canvas.classList.contains('hero-dots')) window.portraitDraws++;
        return draw.apply(this, args);
      };
    });
  }
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(site.origin + url);
  if (javaScriptEnabled) {
    await page.locator('[data-studio].is-ready').waitFor();
    await page.locator('#hero > #figure.is-live').waitFor();
    await page.waitForFunction(() => window.SkyStudio && window.SkyStudio.settled());
  }
  return { context, page, errors };
}

async function markerTop(page) {
  return page.locator('[data-studio-marker]').evaluate(node => node.getBoundingClientRect().top);
}

async function rowTop(page, slug) {
  return page.locator(`#${slug}`).evaluate(node => node.getBoundingClientRect().top);
}

test('the project list scrolls the page and selects by hover, focus, click, keys, and history', async () => {
  const { page, context, errors } = await open({ url: '/#hero' });
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible');
  assert.equal(await page.evaluate(() => SkyStudio.wheel), null);
  assert.equal(await page.locator('[data-studio-wheel], [data-studio-picker], [data-studio-step]').count(), 0);
  assert.equal(await page.evaluate(() => window.SkyWorkbench), undefined);
  assert.equal(await page.evaluate(() => window.SkyPresence), undefined);
  assert.equal(await page.evaluate(() => window.SkyScrollField), undefined);
  const entries = await page.evaluate(() => JSON.parse(document.getElementById('studio-data').textContent).map(item => item.slug));
  assert.deepEqual(entries, ['about', ...PROJECTS, 'contact']);
  assert.equal(await page.locator('#studio-projects [data-studio-pick]').count(), 8);
  assert.equal(await page.locator('#studio-projects [role="option"]').count(), 8);
  assert.equal(await page.locator('#about.studio-row, #contact.studio-row').count(), 0);

  const beforeScroll = await page.evaluate(() => scrollY);
  const list = await page.locator('#studio-projects').boundingBox();
  await page.mouse.move(list.x + 40, list.y + 30);
  await page.mouse.wheel(0, 480);
  await page.waitForFunction(start => scrollY > start + 40, beforeScroll);
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible', 'page scroll does not change the project');

  await page.locator('#shipgate').hover();
  await page.waitForFunction(() => document.getElementById('project-shipgate').classList.contains('is-shown'));
  assert.equal(await page.locator('#agentcrucible').getAttribute('aria-selected'), 'true', 'hover previews without committing');
  assert.equal(await page.locator('#shipgate').getAttribute('aria-selected'), 'false');
  await page.waitForFunction(() => {
    const marker = document.querySelector('[data-studio-marker]').getBoundingClientRect().top;
    const row = document.getElementById('shipgate').getBoundingClientRect().top;
    return Math.abs(marker - row) <= 2;
  });
  const previewMarker = await markerTop(page);
  assert.ok(Math.abs(previewMarker - await rowTop(page, 'shipgate')) <= 2, 'the marker follows the shown preview');
  await page.mouse.move(8, 8);
  await page.waitForFunction(() => document.getElementById('project-agentcrucible').classList.contains('is-shown'));

  await page.locator('#spanforge').focus();
  await page.waitForFunction(() => document.getElementById('project-spanforge').classList.contains('is-shown'));
  assert.equal(await page.locator('#agentcrucible').getAttribute('aria-selected'), 'true');

  const origin = await page.locator('[data-studio-marker]').evaluate(node => {
    const wrap = node.parentElement.getBoundingClientRect();
    return node.getBoundingClientRect().top - wrap.top;
  });
  await page.locator('#studio-projects').focus();
  await page.keyboard.press('End');
  const samples = await page.evaluate(() => new Promise(resolve => {
    const marker = document.querySelector('[data-studio-marker]');
    const tops = [];
    const start = performance.now();
    const tick = () => {
      const wrap = marker.parentElement.getBoundingClientRect();
      tops.push(marker.getBoundingClientRect().top - wrap.top);
      if (performance.now() - start < 280) requestAnimationFrame(tick);
      else resolve(tops);
    };
    requestAnimationFrame(tick);
  }));
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'moltdao');
  assert.equal(await page.evaluate(() => location.hash), '#project-moltdao');
  const destination = samples[samples.length - 1];
  assert.ok(samples.some(top => top > origin + 8 && top < destination - 4), `the marker travels between rows (${origin} -> ${destination})`);
  await page.waitForFunction(() => {
    const marker = document.querySelector('[data-studio-marker]').getBoundingClientRect().top;
    const row = document.getElementById('moltdao').getBoundingClientRect().top;
    return Math.abs(marker - row) <= 2;
  });
  const endBox = await page.locator('#moltdao').boundingBox();
  const view = page.viewportSize();
  assert.ok(endBox.y >= 0 && endBox.y + endBox.height <= view.height + 1, 'End keeps the selected row in view');

  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'ghost-notetaker', 'a reversal replaces the in-flight selection');
  assert.equal(await page.locator('[aria-selected="true"]').count(), 1);
  assert.ok(Math.abs(await markerTop(page) - await rowTop(page, 'ghost-notetaker')) <= 2);

  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible');
  assert.equal(await page.locator('[data-studio-panel].work-card.is-shown').count(), 1);
  assert.equal(await page.locator('[data-studio-panel].work-card:not(.is-shown)').evaluateAll(cards => cards.every(card => card.inert && card.getAttribute('aria-hidden') === 'true')), true);
  assert.equal(await page.locator('#project-agentcrucible').evaluate(card => card.inert || card.getAttribute('aria-hidden') !== 'false'), false);

  await page.evaluate(() => SkyStudio.selectSlug('shipgate'));
  await page.waitForFunction(() => SkyStudio.slug() === 'shipgate' && location.hash === '#project-shipgate');
  await page.evaluate(() => SkyStudio.selectSlug('localpulse'));
  await page.waitForFunction(() => SkyStudio.slug() === 'localpulse');
  await page.goBack();
  await page.waitForFunction(() => SkyStudio.slug() === 'shipgate' && location.hash === '#project-shipgate');
  await page.goForward();
  await page.waitForFunction(() => SkyStudio.slug() === 'localpulse');
  await page.goto(site.origin + '/#work-list');
  await page.waitForFunction(() => SkyStudio.slug() === 'localpulse' && location.hash === '#work-list');
  await page.goto(site.origin + '/#contact');
  await page.waitForFunction(() => SkyStudio.slug() === 'contact');
  assert.equal(await page.locator('#contact a[href^="mailto:"]').getAttribute('href'), 'mailto:hello@aakashdahal.fun');
  await page.locator('#ghost-notetaker').click();
  await page.waitForFunction(() => SkyStudio.slug() === 'ghost-notetaker' && document.getElementById('project-ghost-notetaker').classList.contains('is-shown'));
  await page.locator('#project-ghost-notetaker .scene-links a').first().click();
  await page.waitForURL('**/work/ghost-notetaker/');
  assert.deepEqual(errors, []);
  await context.close();
});

test('desktop, tablet, and phone keep a centered portrait, a vertical list, and reachable contact', async () => {
  const sizes = [[1440, 900], [1024, 900], [768, 1024], [390, 844], [360, 800]];
  for (const [width, height] of sizes) {
    const { page, context, errors } = await open({
      viewport: { width, height },
      reducedMotion: 'reduce',
      hasTouch: width <= 390,
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `${width} overflows by ${overflow}px`);
    const figure = await page.locator('#hero > #figure').boundingBox();
    const stage = await page.locator('#hero').boundingBox();
    assert.ok(figure.width >= 180 && figure.height >= 180, `${width} portrait is ${figure.width}x${figure.height}`);
    assert.ok(Math.abs((figure.x + figure.width / 2) - (stage.x + stage.width / 2)) <= 8, `${width} portrait is off center`);
    const stageBox = await page.evaluate(() => {
      const hero = document.getElementById('hero').getBoundingClientRect();
      const header = document.querySelector('.studio-header').getBoundingClientRect();
      return { top: hero.top, bottom: hero.bottom, headerBottom: header.bottom, inner: innerHeight };
    });
    assert.ok(stageBox.top <= stageBox.headerBottom + 2, `${width} stage starts under the header`);
    assert.ok(stageBox.bottom >= stageBox.inner - 16, `${width} stage fills the first viewport (${stageBox.bottom} vs ${stageBox.inner})`);
    assert.ok(figure.y >= stage.y && figure.y + figure.height <= stage.y + stage.height + 1);
    const columns = await page.locator('.studio-work-layout').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width > 720 ? 2 : 1, `${width} uses ${columns} work columns`);
    const rows = await page.locator('#studio-projects a').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i] >= rows[i - 1] + 20, `${width} list is not vertical`);
    await page.locator('#airforge').click();
    await page.waitForFunction(() => SkyStudio.slug() === 'airforge');
    const detail = await page.locator('#project-airforge').boundingBox();
    if (width <= 720) assert.ok(Math.abs(detail.x - (await page.locator('#studio-projects').boundingBox()).x) <= 4);
    else assert.ok(detail.x > (await page.locator('#studio-projects').boundingBox()).x + 40);
    await page.locator('a[href="#contact"]').first().click();
    await page.waitForFunction(() => document.getElementById('contact').getBoundingClientRect().top < innerHeight);
    const accessibility = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(accessibility.violations.map(v => `${v.id}:${v.nodes.map(n => n.target).join('|')}`), []);
    if (process.env.CRAFT_SHOTS) {
      fs.mkdirSync(process.env.CRAFT_SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CRAFT_SHOTS, `full-${width}.png`) });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});



test('avatar appearance stays on the original figure and the page keeps scrolling', async () => {
  for (const width of [1440, 390]) {
    const { page, context, errors } = await open({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const paper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
    for (const [selector, mode, color] of [['[data-gear-toggle]', 'two', '#ff3b30'], ['[data-gear-blue]', 'blue', '#4f9bff']]) {
      await page.locator(selector).click();
      assert.equal(await page.locator('html').getAttribute('data-gear'), mode);
      assert.equal(await page.locator(selector).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()), paper);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--figure-ink').trim()), color);
      assert.equal(await page.locator('.studio-avatar-controls button[aria-pressed="true"]').count(), 1);
    }
    await page.locator('[data-gear-neutral]').click();
    assert.equal(await page.locator('html').getAttribute('data-gear'), null);
    assert.equal(await page.locator('[data-gear-neutral]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-lamp]').click();
    assert.equal(await page.locator('[data-lamp]').getAttribute('aria-pressed'), 'true');
    const start = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 700);
    await page.waitForFunction(value => scrollY > value, start);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('the persistent portrait keeps drawing across projects, pauses when reduced, and returns from the viewer', async () => {
  const { page, context, errors } = await open({ hookHero: true, url: '/#about' });
  await page.waitForTimeout(250);
  const frames = await page.evaluate(() => window.portraitDraws);
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => window.portraitDraws) > frames, 'the centered portrait keeps drawing');
  await page.evaluate(() => SkyStudio.selectSlug('airforge'));
  await page.waitForFunction(() => SkyStudio.slug() === 'airforge');
  const away = await page.evaluate(() => window.portraitDraws);
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => window.portraitDraws) > away, 'selecting a project leaves the portrait running');
  assert.equal(await page.locator('#hero > #figure').count(), 1);
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-motion') === 'reduced');
  const paused = await page.evaluate(() => window.portraitDraws);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.portraitDraws), paused, 'reduced motion freezes portrait draws');
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-motion'));
  const figure = await page.evaluate(() => {
    const node = document.getElementById('figure');
    node.dataset.instance = 'hermes';
    return node.querySelectorAll('canvas').length;
  });
  await page.locator('[data-studio-zoom="about"]').click();
  assert.equal(await page.evaluate(() => {
    const node = document.querySelector('#studio-viewer .studio-viewer-stage > #figure');
    return !!(node && node.dataset.instance === 'hermes' && node.classList.contains('is-live'));
  }), true);
  assert.equal(await page.locator('#figure').count(), 1);
  assert.equal(figure, await page.locator('#figure canvas').count());
  await page.locator('[data-studio-viewer-close]').click();
  assert.equal(await page.evaluate(() => document.querySelector('#hero > #figure') && document.getElementById('figure').dataset.instance === 'hermes'), true);
  assert.equal(await page.locator('[data-studio-zoom="about"]').evaluate(button => button === document.activeElement), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('without JavaScript the portrait, eight projects, evidence, and contact stay in the document', async () => {
  const { page, context } = await open({ javaScriptEnabled: false, url: '/' });
  assert.equal(await page.locator('#hero > #figure .still').count(), 1);
  assert.equal(await page.locator('#studio-projects a').count(), 8);
  assert.deepEqual(await page.locator('#studio-projects a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), PROJECTS.map(slug => `#project-${slug}`));
  assert.equal(await page.locator('article.work-card').count(), 8);
  for (const slug of PROJECTS) {
    assert.equal(await page.locator(`#project-${slug}`).isVisible(), true, slug);
    assert.equal(await page.locator(`#project-${slug} [data-project-lab="${slug}"]`).count(), 1);
  }
  assert.match(await page.locator('#project-agentcrucible figcaption').innerText(), /fictional demo workspace/);
  assert.equal(await page.locator('#contact a[href="mailto:hello@aakashdahal.fun"]').count(), 1);
  assert.equal(await page.locator('[data-studio-wheel]').count(), 0);
  await context.close();
});

test('site index and header controls still find a project', async () => {
  const { page, context, errors } = await open({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce', hasTouch: true });
  assert.match(await page.locator('.studio-header').innerText(), /Aakash/);
  await page.locator('[data-index-open]').click();
  await page.locator('[data-index-search]').fill('python');
  assert.match(await page.locator('.index-projects [data-index-item]:not([hidden])').innerText(), /Recall/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#site-index').evaluate(dialog => dialog.open), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('AirForge playground stays unloaded until a plain click, then releases the frame', async () => {
  const { page, context, errors } = await open({ url: '/', reducedMotion: 'reduce' });
  const framed = [];
  await page.route('https://skysssup.github.io/airforge/**', route => {
    framed.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>local airforge fixture</title><p>fixture</p>',
    });
  });
  await page.locator('#airforge').click();
  await page.waitForFunction(() => document.getElementById('project-airforge').classList.contains('is-shown'));
  const link = page.locator('#project-airforge [data-playground-open]');
  const href = await link.getAttribute('href');
  assert.match(href, /^https:\/\/skysssup\.github\.io\/airforge\/\?example=ramp-and-ball$/);
  assert.equal(await page.locator('iframe').count(), 0);
  await page.evaluate(() => {
    const node = document.querySelector('#project-airforge [data-playground-open]');
    node.addEventListener('click', event => { window.__playgroundClick = { defaultPrevented: event.defaultPrevented, ctrl: event.ctrlKey }; });
  });
  const popupPromise = page.waitForEvent('popup', { timeout: 4000 }).catch(() => null);
  await link.click({ modifiers: ['Control'] });
  const popup = await popupPromise;
  const modified = await page.evaluate(() => window.__playgroundClick);
  assert.equal(modified.ctrl, true);
  assert.equal(modified.defaultPrevented, false);
  assert.equal(await page.locator('dialog.project-playground[open]').count(), 0);
  assert.equal(await page.locator('iframe').count(), 0);
  if (popup) await popup.close();
  await link.click();
  const dialog = page.locator('dialog.project-playground');
  await page.waitForFunction(() => document.querySelector('dialog.project-playground')?.open);
  const frame = dialog.locator('iframe');
  assert.equal(await frame.getAttribute('src'), href);
  assert.match(await frame.getAttribute('allow'), /camera 'none'/);
  assert.match(await frame.getAttribute('allow'), /microphone 'none'/);
  const started = Date.now();
  while (!framed.some(url => url.startsWith(href)) && Date.now() - started < 5000) await page.waitForTimeout(50);
  assert.ok(framed.some(url => url.startsWith(href)), 'the dialog frame requests the AirForge URL');
  if (await page.evaluate(() => document.activeElement === document.querySelector('dialog.project-playground iframe'))) {
    await page.keyboard.press('Shift+Tab');
  }
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close playground');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.project-playground')?.open);
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await link.evaluate(node => node === document.activeElement), true);
  await link.click();
  await page.waitForFunction(() => document.querySelector('dialog.project-playground')?.open);
  await dialog.getByRole('button', { name: 'Close playground' }).click();
  await page.waitForFunction(() => !document.querySelector('dialog.project-playground')?.open);
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await link.evaluate(node => node === document.activeElement), true);
  assert.deepEqual(errors, []);
  await context.close();
});
