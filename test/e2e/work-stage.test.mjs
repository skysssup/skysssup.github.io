import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECTS = ['agentcrucible', 'airforge', 'shipgate'];
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
    await page.waitForFunction(() => window.SkyStudio && window.SkyStudio.settled());
    // #about and #work-list leave the absolute/sticky portrait offscreen. Do not
    // wait for a draw until a native visit has put the figure in the viewport.
    const portraitOffscreen = await page.evaluate(() => {
      const fig = document.getElementById('figure');
      if (!fig) return true;
      const box = fig.getBoundingClientRect();
      return box.width < 8 || box.bottom <= 0 || box.top >= innerHeight;
    });
    if (portraitOffscreen) {
      await page.locator('.studio-brand').click();
      await page.waitForFunction(() => SkyStudio.slug() === 'about' && SkyStudio.settled() && scrollY < 2);
    }
    await page.locator('#figure.is-live').waitFor();
  }
  return { context, page, errors };
}

async function markerTop(page) {
  return page.locator('[data-studio-marker]').evaluate(node => node.getBoundingClientRect().top);
}

async function rowTop(page, slug) {
  return page.locator(`#${slug}`).evaluate(node => node.getBoundingClientRect().top);
}

async function headerClick(page, hash) {
  const box = await page.locator(`.studio-header a[href="${hash}"]`).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height, 'the sticky header link is visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

function bandProbe(name) {
  const header = document.querySelector('.studio-header');
  const pad = header ? header.offsetHeight : 0;
  const line = pad + (innerHeight - pad) * 0.34;
  const order = ['agentcrucible', 'airforge', 'shipgate'];
  const article = document.getElementById(`project-${name}`);
  const box = article.getBoundingClientRect();
  const idx = order.indexOf(name);
  const next = idx < order.length - 1
    ? document.getElementById(`project-${order[idx + 1]}`)
    : document.getElementById('contact');
  const nextTop = next.getBoundingClientRect().top;
  const narrow = matchMedia('(max-width: 720px)').matches;
  const nav = document.querySelector('.studio-list-wrap');
  const clearance = pad + (narrow && nav ? nav.offsetHeight + 8 : 0);
  const marker = document.querySelector('[data-studio-marker]');
  const markerBox = marker.getBoundingClientRect();
  const index = (marker.closest('.studio-index') || marker.parentElement).getBoundingClientRect();
  const reduced = document.documentElement.dataset.motion === 'reduced'
    || (document.documentElement.dataset.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const markerOk = narrow || reduced
    ? getComputedStyle(marker).display === 'none' || markerBox.height === 0
    : marker.classList.contains('is-set') && Math.abs((markerBox.top + markerBox.height / 2) - (index.top + index.height / 2)) <= 12;
  return {
    inBand: box.top <= line + 1 && nextTop > line + 1,
    slug: window.SkyStudio.slug(),
    delta: box.top - line + 48,
    above: nextTop <= line + 1,
    landed: box.top >= pad - 2 && box.top <= clearance + 36,
    markerOk,
  };
}

async function waitLenisIdle(page) {
  await page.evaluate(() => { window.__lenisMark = null; window.__lenisStill = 0; });
  await page.waitForFunction(() => {
    const root = document.documentElement;
    if (root.classList.contains('lenis-scrolling')) return false;
    const y = scrollY;
    if (window.__lenisMark == null || Math.abs(y - window.__lenisMark) > 0.5) {
      window.__lenisMark = y;
      window.__lenisStill = 0;
      return false;
    }
    window.__lenisStill += 1;
    return window.__lenisStill >= 3;
  }, null, { polling: 50 });
}

async function wheelToArticle(page, slug) {
  const list = await page.locator('#studio-projects').boundingBox();
  if (list) await page.mouse.move(list.x + Math.min(48, list.width / 2), list.y + Math.min(36, list.height / 2));
  for (let step = 0; step < 24; step += 1) {
    await waitLenisIdle(page);
    const probe = await page.evaluate(bandProbe, slug);
    if (probe.inBand && probe.slug === slug) return;
    await page.mouse.wheel(0, Math.max(-320, Math.min(320, probe.delta)));
  }
  await waitLenisIdle(page);
  const probe = await page.evaluate(bandProbe, slug);
  assert.equal(probe.inBand, true, `#project-${slug} never settled in the viewing band`);
}

async function committed(page, slug) {
  await page.waitForFunction(name => {
    const header = document.querySelector('.studio-header');
    const pad = header ? header.offsetHeight : 0;
    const line = pad + (innerHeight - pad) * 0.34;
    const order = ['agentcrucible', 'airforge', 'shipgate'];
    const article = document.getElementById(`project-${name}`);
    const box = article.getBoundingClientRect();
    const idx = order.indexOf(name);
    const next = idx < order.length - 1
      ? document.getElementById(`project-${order[idx + 1]}`)
      : document.getElementById('contact');
    const inBand = box.top <= line + 1 && next.getBoundingClientRect().top > line + 1;
    const narrow = matchMedia('(max-width: 720px)').matches;
    const nav = document.querySelector('.studio-list-wrap');
    const clearance = pad + (narrow && nav ? nav.offsetHeight + 8 : 0);
    const landed = box.top >= pad - 2 && box.top <= clearance + 36;
    const selected = [...document.querySelectorAll('[aria-selected="true"]')];
    const marker = document.querySelector('[data-studio-marker]');
    const markerBox = marker.getBoundingClientRect();
    const index = (marker.closest('.studio-index') || marker.parentElement).getBoundingClientRect();
    const reduced = document.documentElement.dataset.motion === 'reduced'
      || (document.documentElement.dataset.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const markerOk = narrow || reduced
      ? getComputedStyle(marker).display === 'none' || markerBox.height === 0
      : marker.classList.contains('is-set') && Math.abs((markerBox.top + markerBox.height / 2) - (index.top + index.height / 2)) <= 12;
    return window.SkyStudio.slug() === name
      && window.SkyStudio.settled()
      && selected.length === 1
      && selected[0].id === name
      && location.hash === `#project-${name}`
      && article.classList.contains('is-shown')
      && (inBand || landed)
      && markerOk;
  }, slug, { timeout: 8000 }).catch(async error => {
    console.error('Project commit state', await page.evaluate(name => {
      const marker = document.querySelector('[data-studio-marker]');
      const index = marker.closest('.studio-index');
      const article = document.getElementById('project-' + name);
      return { name, slug: SkyStudio.slug(), hash: location.hash, y: scrollY,
        settled: SkyStudio.settled(), selected: [...document.querySelectorAll('[aria-selected="true"]')].map(n => n.id),
        marker: marker.className, markerDisplay: getComputedStyle(marker).display,
        markerBox: marker.getBoundingClientRect().toJSON(), index: index.getBoundingClientRect().toJSON(),
        article: article.getBoundingClientRect().toJSON(), motion: document.documentElement.dataset.motion };
    }, slug));
    throw error;
  });
}

test('the project list scrolls the page and selects by hover, focus, click, keys, and history', async () => {
  const { page, context, errors } = await open({ url: '/' });
  assert.equal(await page.evaluate(() => scrollY), 0);
  const hero = await page.locator('#hero').boundingBox();
  assert.ok(hero && hero.height > 80 && hero.y < 900 && hero.y + hero.height > 0, 'the portrait intersects the first viewport');
  assert.equal(PROJECTS.includes(await page.evaluate(() => SkyStudio.slug())), false);
  assert.equal(await page.evaluate(() => SkyStudio.wheel), null);
  assert.equal(await page.locator('[data-studio-wheel], [data-studio-picker], [data-studio-step]').count(), 0);
  assert.equal(await page.evaluate(() => window.SkyWorkbench), undefined);
  assert.equal(await page.evaluate(() => window.SkyPresence), undefined);
  assert.equal(await page.evaluate(() => window.SkyScrollField), undefined);
  const entries = await page.evaluate(() => JSON.parse(document.getElementById('studio-data').textContent).map(item => item.slug));
  assert.deepEqual(entries, ['about', ...PROJECTS, 'contact']);
  assert.equal(await page.locator('#studio-projects [data-studio-pick]').count(), 3);
  assert.equal(await page.locator('#studio-projects [role="option"]').count(), 3);
  assert.equal(await page.locator('#about.studio-row, #contact.studio-row').count(), 0);

  const beforeScroll = await page.evaluate(() => scrollY);
  const list = await page.locator('#studio-projects').boundingBox();
  await page.mouse.move(list.x + 40, list.y + 30);
  await page.mouse.wheel(0, 480);
  await page.waitForFunction(start => scrollY > start + 100, beforeScroll);
  assert.notEqual(await page.evaluate(() => SkyStudio.slug()), 'contact', 'a list wheel does not wrap into contact');
  assert.notEqual(await page.evaluate(() => location.hash), '#contact');

  await wheelToArticle(page, 'airforge');
  await committed(page, 'airforge');
  const stacked = await page.locator('article.work-card').evaluateAll(cards => cards.map(card => ({
    top: card.offsetTop,
    height: card.offsetHeight,
    inert: card.inert,
    hidden: card.getAttribute('aria-hidden'),
  })));
  assert.equal(stacked.length, 3);
  for (let i = 1; i < stacked.length; i += 1) {
    assert.ok(stacked[i].top >= stacked[i - 1].top + stacked[i - 1].height - 1, 'articles stay stacked in flow');
  }
  assert.ok(stacked.every(card => card.inert === false && card.hidden !== 'true'));

  await wheelToArticle(page, 'shipgate');
  await committed(page, 'shipgate');
  const agentAbove = await page.locator('#project-agentcrucible').evaluate(node => {
    const header = document.querySelector('.studio-header').getBoundingClientRect().bottom;
    return node.getBoundingClientRect().bottom < header;
  });
  assert.equal(agentAbove, true, 'AgentCrucible has scrolled above the header');
  await wheelToArticle(page, 'agentcrucible');
  await committed(page, 'agentcrucible');

  const committedSlug = 'agentcrucible';
  const committedHash = await page.evaluate(() => location.hash);
  const shipRow = await page.locator('#shipgate').boundingBox();
  await page.mouse.move(shipRow.x + 12, shipRow.y + 12);
  await page.waitForTimeout(120);
  assert.equal(await page.locator(`#${committedSlug}`).getAttribute('aria-selected'), 'true', 'hover previews without committing');
  assert.equal(await page.locator('#shipgate').getAttribute('aria-selected'), 'false');
  assert.equal(await page.evaluate(() => location.hash), committedHash);
  assert.equal(await page.locator('#project-agentcrucible').evaluate(node => node.classList.contains('is-shown')), true);
  assert.equal(await page.evaluate(() => {
    const marker = document.querySelector('[data-studio-marker]');
    const m = marker.getBoundingClientRect();
    const i = (marker.closest('.studio-index') || marker.parentElement).getBoundingClientRect();
    return marker.classList.contains('is-set') && Math.abs((m.top + m.height / 2) - (i.top + i.height / 2)) <= 12;
  }), true, 'the marker stays on the wheel center');
  await page.mouse.move(8, 8);

  await page.locator('#airforge').focus();
  await page.waitForTimeout(120);
  assert.equal(await page.locator('#agentcrucible').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#project-agentcrucible').evaluate(node => node.classList.contains('is-shown')), true);

  const origin = await page.locator('[data-studio-marker]').evaluate(node => {
    const wrap = node.parentElement.getBoundingClientRect();
    return node.getBoundingClientRect().top - wrap.top;
  });
  await page.locator('#studio-projects').focus();
  await page.evaluate(() => {
    const marker = document.querySelector('[data-studio-marker]');
    window.__markerSamples = [];
    window.__markerDone = false;
    const start = performance.now();
    const tick = () => {
      const wrap = marker.parentElement.getBoundingClientRect();
      window.__markerSamples.push(marker.getBoundingClientRect().top - wrap.top);
      if (performance.now() - start < 280) requestAnimationFrame(tick);
      else window.__markerDone = true;
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('End');
  await page.waitForFunction(() => window.__markerDone);
  const samples = await page.evaluate(() => window.__markerSamples);
  await committed(page, 'shipgate');
  assert.ok(samples.every(top => Math.abs(top - origin) <= 8), `the center tick does not chase a thumbnail (${origin})`);
  const endBox = await page.locator('#shipgate').boundingBox();
  const view = page.viewportSize();
  assert.ok(endBox.y >= 0 && endBox.y + endBox.height <= view.height + 1, 'End keeps the selected row in view');

  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'airforge', 'a reversal replaces the in-flight selection');
  assert.equal(await page.locator('[aria-selected="true"]').count(), 1);
  assert.equal(await page.evaluate(() => {
    const marker = document.querySelector('[data-studio-marker]');
    const m = marker.getBoundingClientRect();
    const i = (marker.closest('.studio-index') || marker.parentElement).getBoundingClientRect();
    return Math.abs((m.top + m.height / 2) - (i.top + i.height / 2)) <= 12;
  }), true);

  await page.keyboard.press('Home');
  await committed(page, 'agentcrucible');
  assert.equal(await page.locator('[data-studio-panel].work-card.is-shown').count(), 1);
  assert.equal(await page.locator('article.work-card').evaluateAll(cards => cards.every(card => card.inert === false && card.getAttribute('aria-hidden') !== 'true')), true);

  await page.locator('#shipgate').click();
  await committed(page, 'shipgate');
  await page.locator('#shipgate').click();
  await committed(page, 'shipgate');
  await page.goBack();
  await committed(page, 'agentcrucible');
  await page.goForward();
  await committed(page, 'shipgate');
  await headerClick(page, '#contact');
  await page.waitForFunction(() => {
    const header = document.querySelector('.studio-header').getBoundingClientRect().bottom;
    const contact = document.getElementById('contact').getBoundingClientRect();
    return location.hash === '#contact' && SkyStudio.slug() === 'contact' && SkyStudio.settled() && contact.top >= header - 2;
  });
  assert.equal(await page.locator('#contact a[href^="mailto:"]').getAttribute('href'), 'mailto:hello@aakashdahal.fun');
  await headerClick(page, '#work-list');
  await waitLenisIdle(page);
  const air = await page.locator('#airforge').boundingBox();
  assert.ok(air && air.y >= 0 && air.y + air.height <= page.viewportSize().height, 'AirForge thumbnail is visible');
  await page.mouse.click(air.x + air.width / 2, air.y + Math.min(air.height / 2, 40));
  await committed(page, 'airforge');
  await page.locator('#project-airforge .scene-links a').first().click();
  await page.waitForURL('**/work/airforge/');
  assert.deepEqual(errors, []);
  await context.close();
});

test('desktop, tablet, and phone keep a centered portrait, a fitting project nav, and reachable contact', async () => {
  const sizes = [[1440, 900], [1024, 900], [768, 1024], [390, 844], [360, 800]];
  for (const [width, height] of sizes) {
    const { page, context, errors } = await open({
      viewport: { width, height },
      reducedMotion: 'reduce',
      hasTouch: width <= 390,
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `${width} overflows by ${overflow}px`);
    const figure = await page.locator('#figure').boundingBox();
    const stage = await page.locator('#hero').boundingBox();
    assert.ok(figure.width >= 180 && figure.height >= 180, `${width} portrait is ${figure.width}x${figure.height}`);
    assert.ok(Math.abs((figure.x + figure.width / 2) - (stage.x + stage.width / 2)) <= 8, `${width} portrait is off center`);
    const stageBox = await page.evaluate(() => {
      const hero = document.getElementById('hero').getBoundingClientRect();
      const header = document.querySelector('.studio-header').getBoundingClientRect();
      return { top: hero.top, bottom: hero.bottom, headerBottom: header.bottom, inner: innerHeight };
    });
    assert.ok(stageBox.top <= stageBox.headerBottom + 2, `${width} stage starts under the header`);
    assert.ok(stageBox.bottom > stageBox.headerBottom + 80, `${width} portrait occupies the opening viewport`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 80), `${width} articles extend the page`);
    assert.ok(figure.y >= stage.y && figure.y + figure.height <= stage.y + stage.height + 1);
    const columns = await page.locator('.studio-work-layout').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width > 720 ? 2 : 1, `${width} uses ${columns} work columns`);
    const rows = await page.locator('#studio-projects a').evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect();
      return { top: box.top, left: box.left, width: box.width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
    }));
    if (width <= 720) {
      assert.equal(await page.locator('#studio-projects').evaluate(node => getComputedStyle(node).display), 'none');
      const select = page.locator('[data-studio-project-select]');
      assert.equal(await select.isVisible(), true);
      assert.deepEqual(await select.locator('option').evaluateAll(nodes => nodes.map(node => node.value)), ['agentcrucible', 'airforge', 'shipgate']);
    } else {
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i].top >= rows[i - 1].top + 20, `${width} reduced-motion list stays upright`);
    }
    await headerClick(page, '#work-list');
    await page.waitForFunction(() => SkyStudio.settled());
    if (width <= 720) await page.locator('[data-studio-project-select]').selectOption('airforge');
    else {
      const tile = await page.locator('#airforge').boundingBox();
      assert.ok(tile && tile.height > 0);
      await page.mouse.click(tile.x + tile.width / 2, tile.y + Math.min(tile.height / 2, 40));
    }
    await committed(page, 'airforge');
    const detail = await page.locator('#project-airforge').boundingBox();
    if (width > 720) assert.ok(detail.x > (await page.locator('#studio-projects').boundingBox()).x + 40);
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



test('avatar appearance stays on the original figure while the page still scrolls', async () => {
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
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('[data-lamp]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()), '#f7f6f3');
    assert.equal(await page.locator('#figure').count(), 1);
    const litPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
    await page.locator('[data-gear-toggle]').click();
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()), litPaper);
    const start = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 700);
    await page.waitForFunction(y => scrollY > y + 100, start);
    assert.equal(await page.locator('#figure').count(), 1);
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
  await wheelToArticle(page, 'airforge');
  await committed(page, 'airforge');
  const away = await page.evaluate(() => window.portraitDraws);
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => window.portraitDraws) > away, 'selecting a project leaves the portrait running');
  assert.equal(await page.locator('#figure').count(), 1);
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-motion') === 'reduced');
  const paused = await page.evaluate(() => window.portraitDraws);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.portraitDraws), paused, 'reduced motion freezes portrait draws');
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-motion'));
  await page.locator('.studio-brand').click();
  await page.waitForFunction(() => {
    const header = document.querySelector('.studio-header').getBoundingClientRect().bottom;
    const hero = document.getElementById('hero').getBoundingClientRect();
    return hero.top < innerHeight && hero.bottom > header;
  });
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
  await page.waitForFunction(() => !document.getElementById('studio-viewer').open && document.getElementById('figure').parentElement.classList.contains('studio-figure-slot'));
  await page.waitForFunction(() => document.activeElement === document.querySelector('[data-studio-zoom="about"]'));
  assert.equal(await page.evaluate(() => {
    const node = document.getElementById('figure');
    return !!(node && node.dataset.instance === 'hermes' && node.parentElement.classList.contains('studio-figure-slot') && !node.closest('#hero'));
  }), true);
  assert.equal(await page.locator('[data-studio-zoom="about"]').evaluate(button => button === document.activeElement), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('without JavaScript the portrait, three projects, evidence, and contact stay in the document', async () => {
  const { page, context } = await open({ javaScriptEnabled: false, url: '/' });
  assert.equal(await page.locator('#figure .still').count(), 1);
  assert.equal(await page.locator('#studio-projects a').count(), 3);
  assert.deepEqual(await page.locator('#studio-projects a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), PROJECTS.map(slug => `#project-${slug}`));
  assert.equal(await page.locator('article.work-card').count(), 3);
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
  await page.locator('[data-index-search]').fill('AirForge');
  assert.match(await page.locator('.index-projects [data-index-item]:not([hidden])').innerText(), /AirForge/);
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
  await committed(page, 'airforge');
  const link = page.locator('#project-airforge [data-playground-open]');
  const href = await link.getAttribute('href');
  assert.match(href, /^https:\/\/skysssup\.github\.io\/airforge\/\?example=ramp-and-ball$/);
  assert.equal(await page.locator('iframe').count(), 0);
  const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
  await link.click({ modifiers: ['Control'] });
  const popup = await popupPromise;
  assert.equal(popup, null, 'a modified click does not open a playground popup');
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
  await page.waitForFunction(() => !document.querySelector('dialog.project-playground')?.open && document.querySelectorAll('iframe').length === 0);
  await page.waitForFunction(() => document.activeElement === document.querySelector('#project-airforge [data-playground-open]'));
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await link.evaluate(node => node === document.activeElement), true);
  await link.click();
  await page.waitForFunction(() => document.querySelector('dialog.project-playground')?.open);
  await dialog.getByRole('button', { name: 'Close playground' }).click();
  await page.waitForFunction(() => !document.querySelector('dialog.project-playground')?.open && document.querySelectorAll('iframe').length === 0);
  await page.waitForFunction(() => document.activeElement === document.querySelector('#project-airforge [data-playground-open]'));
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await link.evaluate(node => node === document.activeElement), true);
  assert.deepEqual(errors, []);
  await context.close();
});


test('native hashes, history, and reduced motion scroll the stacked page', async () => {
  const { page, context, errors } = await open({ url: '/', viewport: { width: 1440, height: 900 } });
  const overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflow);
  assert.notEqual(overflow, 'hidden');
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 80));
  await headerClick(page, '#work-list');
  await page.waitForFunction(() => {
    const header = document.querySelector('.studio-header').getBoundingClientRect().bottom;
    const article = document.getElementById('project-agentcrucible').getBoundingClientRect();
    return location.hash === '#work-list' && SkyStudio.slug() === 'agentcrucible' && SkyStudio.settled() && article.top >= header - 2;
  });
  await page.locator('#shipgate').click();
  await committed(page, 'shipgate');
  const airRow = await page.locator('#airforge').boundingBox();
  await page.mouse.move(airRow.x + 12, airRow.y + 12);
  await page.waitForTimeout(120);
  assert.equal(await page.locator('#shipgate').getAttribute('aria-selected'), 'true', 'preview does not drop the commit');
  assert.equal(await page.evaluate(() => location.hash), '#project-shipgate');
  assert.equal(await page.locator('#project-shipgate').evaluate(node => node.classList.contains('is-shown')), true);
  await page.mouse.move(8, 8);
  await headerClick(page, '#contact');
  await page.waitForFunction(() => {
    const header = document.querySelector('.studio-header').getBoundingClientRect().bottom;
    const contact = document.getElementById('contact').getBoundingClientRect();
    return location.hash === '#contact' && SkyStudio.slug() === 'contact' && contact.top >= header - 2;
  });
  await headerClick(page, '#about');
  await page.waitForFunction(() => {
    const header = document.querySelector('.studio-header').getBoundingClientRect().bottom;
    const hero = document.getElementById('hero').getBoundingClientRect();
    return scrollY < 40 && hero.bottom > header && SkyStudio.settled();
  });
  await waitLenisIdle(page);
  await page.goBack();
  await page.waitForFunction(() => location.hash === '#contact' && SkyStudio.slug() === 'contact' && SkyStudio.settled());
  await waitLenisIdle(page);
  await page.goBack();
  await committed(page, 'shipgate');
  await waitLenisIdle(page);
  await page.goBack();
  await page.waitForFunction(() => location.hash === '#work-list' && SkyStudio.slug() === 'agentcrucible' && SkyStudio.settled());
  await waitLenisIdle(page);
  await page.goBack();
  await page.waitForFunction(() => scrollY < 40 && !location.hash);
  await page.goto(site.origin + '/#project-shipgate');
  await committed(page, 'shipgate');
  await page.reload();
  await page.locator('[data-studio].is-ready').waitFor();
  await committed(page, 'shipgate');
  assert.deepEqual(errors, []);
  await context.close();

  const reduced = await open({ url: '/', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await reduced.page.locator('#agentcrucible').click();
  await committed(reduced.page, 'agentcrucible');
  const origin = await reduced.page.locator('[data-studio-marker]').evaluate(node => {
    const wrap = node.parentElement.getBoundingClientRect();
    return node.getBoundingClientRect().top - wrap.top;
  });
  await reduced.page.evaluate(() => {
    const marker = document.querySelector('[data-studio-marker]');
    window.__markerSamples = [];
    window.__markerDone = false;
    const start = performance.now();
    const tick = () => {
      const wrap = marker.parentElement.getBoundingClientRect();
      window.__markerSamples.push(marker.getBoundingClientRect().top - wrap.top);
      if (performance.now() - start < 280) requestAnimationFrame(tick);
      else window.__markerDone = true;
    };
    requestAnimationFrame(tick);
  });
  await reduced.page.locator('#studio-projects').focus();
  await reduced.page.keyboard.press('End');
  await reduced.page.waitForFunction(() => window.__markerDone);
  const tops = await reduced.page.evaluate(() => window.__markerSamples);
  await committed(reduced.page, 'shipgate');
  const destination = tops[tops.length - 1];
  assert.ok(tops.every(top => Math.abs(top - origin) <= 4 || Math.abs(top - destination) <= 4), 'reduced motion does not travel through marker midpoints');
  assert.equal(await reduced.page.locator('[data-studio-panel].work-card.is-shown').count(), 1);
  assert.deepEqual(reduced.errors, []);
  await reduced.context.close();
});

test('a phone stacks three rows and three articles and still scrolls', async () => {
  const { page, context, errors } = await open({ url: '/', viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  assert.equal(await page.locator('#studio-projects [data-studio-pick]').count(), 3);
  assert.equal(await page.locator('article.work-card').count(), 3);
  assert.equal(await page.locator('#studio-projects').evaluate(node => getComputedStyle(node).display), 'none');
  assert.equal(await page.locator('[data-studio-project-select]').isVisible(), true);
  assert.deepEqual(await page.locator('[data-studio-project-select] option').evaluateAll(nodes => nodes.map(node => node.value)), ['agentcrucible', 'airforge', 'shipgate']);
  const articles = await page.locator('article.work-card').evaluateAll(nodes => nodes.map(node => node.offsetTop));
  for (let i = 1; i < articles.length; i += 1) assert.ok(articles[i] > articles[i - 1]);
  const before = await page.evaluate(() => scrollY);
  const column = await page.locator('#project-agentcrucible').boundingBox();
  const client = await context.newCDPSession(page);
  const x = column.x + column.width / 2;
  const y = Math.min(column.y + 80, 700);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 260, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(start => scrollY > start + 40, before);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction), 'none');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `phone overflows by ${overflow}px`);
  assert.deepEqual(errors, []);
  await context.close();
});
