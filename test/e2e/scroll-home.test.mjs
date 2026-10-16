import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECTS = ['agentcrucible', 'airforge', 'shipgate'];

let browser, site;

before(async () => {
  site = await serve(root);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});

after(async () => {
  await browser?.close();
  site?.server?.close();
});

async function openPage(options = {}) {
  const { url = '/', width = 1440, height = 900, reduced = false, touch = false } = options;
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    hasTouch: !!touch,
    isMobile: !!touch,
    colorScheme: 'dark',
  });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('sky-intro', 'seen'); } catch (e) {}
    window.__historyTrace = [];
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method].bind(history);
      history[method] = (...args) => {
        window.__historyTrace.push({ method, hash: args[2], y: scrollY });
        return original(...args);
      };
    }
    addEventListener('popstate', () => window.__historyTrace.push({ method: 'popstate', hash: location.hash, y: scrollY }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(site.origin + url);
  await page.locator('[data-studio].is-ready').waitFor({ timeout: 8000 });
  await page.waitForFunction(
    () => window.SkyStudio && typeof window.SkyStudio.settled === 'function' && window.SkyStudio.settled(),
    null,
    { timeout: 8000 },
  );
  return { context, page, errors };
}

function pose() {
  const fig = document.getElementById('figure');
  const slot = document.querySelector('.studio-figure-slot');
  const frame = document.querySelector('.studio-frame');
  return {
    scale: Number(fig.style.getPropertyValue('--studio-figure-scale') || 1),
    opacity: fig.style.opacity === '' ? 1 : Number(fig.style.opacity),
    transform: fig.style.transform,
    alignSelf: getComputedStyle(fig).alignSelf,
    slot: getComputedStyle(slot).position,
    frameX: getComputedStyle(frame).overflowX,
    canvas: fig.querySelectorAll('canvas').length,
    figures: document.querySelectorAll('#figure').length,
    lenis: document.documentElement.classList.contains('lenis'),
    lenisVersion: window.lenis && window.lenis.version || '',
    lenisTouch: !!(window.lenis && window.lenis.touch),
    canvases: [...fig.querySelectorAll('canvas')].map(node => node.className).sort(),
  };
}

async function lenisIdle(page) {
  let previous = null, quiet = 0;
  for (let sample = 0; sample < 100; sample += 1) {
    const state = await page.evaluate(() => ({ y: scrollY, busy: !window.SkyStudio?.settled() || document.documentElement.classList.contains('lenis-scrolling') }));
    quiet = !state.busy && previous !== null && Math.abs(state.y - previous) < 0.5 ? quiet + 1 : 0;
    if (quiet >= 3) return;
    previous = state.y;
    await page.waitForTimeout(50);
  }
  throw new Error('Document scrolling did not settle');
}

async function headerClick(page, hash) {
  const box = await page.locator(`.studio-header a[href="${hash}"]`).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height, 'the sticky header link is visible');
  // A native pointer click must not first scroll a sticky ancestor into view.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('stacked home keeps three focusable articles and commits the viewing-band project', { timeout: 40000 }, async () => {
  const { context, page, errors } = await openPage();
  try {
    const layout = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      const articles = [...document.querySelectorAll('article.work-card')].map(node => ({
        id: node.id,
        inert: node.inert,
        hidden: node.getAttribute('aria-hidden'),
        tab: node.getAttribute('tabindex'),
        top: node.offsetTop,
        height: node.offsetHeight,
      }));
      return {
        htmlOverflow: html.overflowY,
        bodyOverflow: body.overflowY,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        wheels: document.querySelectorAll('[data-studio-wheel], [data-studio-picker], [data-studio-step]').length,
        articles,
      };
    });
    assert.notEqual(layout.htmlOverflow, 'hidden');
    assert.notEqual(layout.bodyOverflow, 'hidden');
    assert.ok(layout.scrollHeight > layout.innerHeight + 80);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1);
    assert.equal(layout.wheels, 0);
    const opener = await page.evaluate(() => ({
      slug: window.SkyStudio.slug(),
      selected: document.querySelector('[aria-selected="true"]')?.id || null,
      lenis: document.documentElement.classList.contains('lenis'),
      version: window.lenis && window.lenis.version || '',
      touch: !!(window.lenis && window.lenis.touch),
    }));
    assert.equal(opener.slug, 'about');
    assert.equal(opener.selected, null);
    assert.equal(opener.lenis, true);
    assert.match(opener.version, /^\d+\.\d+\.\d+$/);
    assert.equal(opener.touch, false);
    const motion = await page.evaluate(async () => (await fetch('/js/motion.js')).text());
    assert.match(motion, /lerp:\s*0\.1/);
    assert.match(motion, /syncTouch:\s*false/);
    assert.deepEqual(layout.articles.map(card => card.id), PROJECTS.map(slug => `project-${slug}`));
    for (let i = 0; i < layout.articles.length; i += 1) {
      const card = layout.articles[i];
      assert.equal(card.inert, false, card.id);
      assert.notEqual(card.hidden, 'true', card.id);
      assert.equal(card.tab, '-1', `${card.id} stays programmatically focusable`);
      if (i > 0) assert.ok(card.top >= layout.articles[i - 1].top + layout.articles[i - 1].height - 2);
    }

    const before = await page.evaluate(() => scrollY);
    for (let step = 0; step < 28; step += 1) {
      await lenisIdle(page);
      const probe = await page.evaluate(() => {
        const pad = document.querySelector('.studio-header').offsetHeight;
        const line = pad + (innerHeight - pad) * 0.34;
        const air = document.getElementById('project-airforge').getBoundingClientRect().top;
        const ship = document.getElementById('project-shipgate').getBoundingClientRect().top;
        return { inBand: air <= line + 1 && ship > line + 1,
          delta: air > line ? air - line + 48 : ship - line - 48 };
      });
      if (probe.inBand) break;
      await page.mouse.wheel(0, Math.max(-400, Math.min(400, probe.delta)));
      await lenisIdle(page);
    }
    await page.waitForFunction(() => {
      const pad = document.querySelector('.studio-header').offsetHeight;
      const line = pad + (innerHeight - pad) * 0.34;
      const air = document.getElementById('project-airforge').getBoundingClientRect();
      const ship = document.getElementById('project-shipgate').getBoundingClientRect().top;
      const selected = [...document.querySelectorAll('[aria-selected="true"]')];
      const marker = document.querySelector('[data-studio-marker]').getBoundingClientRect().top;
      const row = document.getElementById('airforge').getBoundingClientRect().top;
      return scrollY > 100
        && air.top <= line + 1 && ship > line + 1
        && window.SkyStudio.slug() === 'airforge'
        && window.SkyStudio.settled()
        && selected.length === 1 && selected[0].id === 'airforge'
        && location.hash === '#project-airforge'
        && document.getElementById('project-airforge').classList.contains('is-shown')
        && !document.documentElement.classList.contains('lenis-scrolling')
        && Math.abs(marker - row) <= 2;
    }, null, { timeout: 8000 });
    assert.ok(await page.evaluate(start => scrollY > start + 100, before));

    const hash = await page.evaluate(() => location.hash);
    await page.locator('#shipgate').hover();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('#airforge').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#shipgate').evaluate(node => node.classList.contains('is-preview')), true);
    assert.equal(await page.evaluate(() => location.hash), hash);
    assert.equal(await page.locator('#project-airforge').evaluate(node => node.classList.contains('is-shown')), true);
    await page.mouse.move(8, 8);

    await headerClick(page, '#work-list');
    await page.waitForFunction(() => {
      const pad = document.querySelector('.studio-header').offsetHeight;
      const work = document.getElementById('work-list').getBoundingClientRect();
      return location.hash === '#work-list'
        && window.SkyStudio.slug() === 'agentcrucible'
        && window.SkyStudio.settled()
        && document.getElementById('agentcrucible').getAttribute('aria-selected') === 'true'
        && work.top >= pad - 2;
    });
    const shipRow = await page.locator('#shipgate').boundingBox();
    assert.ok(shipRow && shipRow.y >= 0 && shipRow.y + shipRow.height <= 900);
    await page.mouse.click(shipRow.x + shipRow.width / 2, shipRow.y + shipRow.height / 2);
    await page.waitForFunction(() => {
      const pad = document.querySelector('.studio-header').offsetHeight;
      const top = document.getElementById('project-shipgate').getBoundingClientRect().top;
      return location.hash === '#project-shipgate' && window.SkyStudio.settled() && top >= pad - 2 && top <= pad + 36;
    });
    await headerClick(page, '#contact');
    await page.waitForFunction(() => {
      const pad = document.querySelector('.studio-header').offsetHeight;
      const contact = document.getElementById('contact').getBoundingClientRect();
      const tail = document.documentElement.scrollHeight - (contact.bottom + scrollY);
      return location.hash === '#contact'
        && window.SkyStudio.slug() === 'contact'
        && window.SkyStudio.settled()
        && contact.top >= pad - 2
        && contact.bottom > pad + 40
        && tail < 160;
    });
    await lenisIdle(page);
    await page.goBack();
    await page.waitForFunction(() => location.hash === '#project-shipgate' && window.SkyStudio.slug() === 'shipgate' && window.SkyStudio.settled() && !document.documentElement.classList.contains('lenis-scrolling'), null, { timeout: 8000 }).catch(async error => {
      console.error('Back navigation state', await page.evaluate(() => ({ hash: location.hash, slug: SkyStudio.slug(), settled: SkyStudio.settled(), scroll: scrollY, max: document.documentElement.scrollHeight - innerHeight, classes: document.documentElement.className, history: window.__historyTrace.slice(-14) })));
      throw error;
    });
    await lenisIdle(page);
    await page.goForward();
    await page.waitForFunction(() => location.hash === '#contact' && window.SkyStudio.slug() === 'contact' && window.SkyStudio.settled() && !document.documentElement.classList.contains('lenis-scrolling')).catch(async error => {
      console.error('Forward navigation state', await page.evaluate(() => ({ hash: location.hash, slug: SkyStudio.slug(), settled: SkyStudio.settled(), scroll: scrollY, max: document.documentElement.scrollHeight - innerHeight, classes: document.documentElement.className })));
      throw error;
    });
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.waitForFunction(() => {
      const pad = document.querySelector('.studio-header').offsetHeight;
      const top = document.getElementById('contact').getBoundingClientRect().top;
      return location.hash === '#contact' && window.SkyStudio.slug() === 'contact' && window.SkyStudio.settled() && top >= pad - 2 && top < innerHeight;
    });
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('an explicit work-list anchor stays until the viewing band selects another project', { timeout: 20000 }, async () => {
  const { context, page, errors } = await openPage();
  try {
    await page.locator('a[href="#work-list"]').first().click();
    await page.waitForFunction(() => location.hash === '#work-list' && window.SkyStudio.slug() === 'agentcrucible' && window.SkyStudio.settled());
    await page.mouse.wheel(0, 80);
    await lenisIdle(page);
    const state = await page.evaluate(() => ({
      hash: location.hash,
      slug: window.SkyStudio.slug(),
      selected: document.querySelector('[aria-selected="true"]')?.id || null,
    }));
    assert.equal(state.slug, 'agentcrucible');
    assert.equal(state.selected, 'agentcrucible');
    assert.equal(state.hash, '#work-list', `wheel of 80px rewrote ${state.hash} while AgentCrucible still agreed`);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('the portrait figure scales in document flow and reduced motion leaves it still', { timeout: 40000 }, async () => {
  const full = await openPage();
  try {
    const top = await full.page.evaluate(pose);
    assert.equal(top.figures, 1);
    assert.equal(top.canvas, 2);
    assert.deepEqual(top.canvases, ['hero-dots', 'hero-words']);
    assert.equal(top.lenis, true);
    assert.match(top.lenisVersion, /^\d+\.\d+\.\d+$/);
    assert.equal(top.lenisTouch, false);
    assert.ok(Math.abs(top.scale - 1) < 0.02, `top scale ${top.scale}`);
    assert.ok(top.opacity > 0.95, `top opacity ${top.opacity}`);
    assert.equal(top.alignSelf, 'flex-start');
    assert.equal(top.frameX, 'clip');
    assert.equal(top.slot, 'sticky');
    for (let step = 0; step < 16; step += 1) {
      const recessed = await full.page.evaluate(() => {
        const pad = document.querySelector('.studio-header').offsetHeight;
        const line = pad + (innerHeight - pad) * 0.34;
        return document.getElementById('work-list').getBoundingClientRect().top < line;
      });
      if (recessed) break;
      await full.page.mouse.wheel(0, 500);
      await full.page.waitForTimeout(40);
    }
    await full.page.waitForFunction(() => {
      const fig = document.getElementById('figure');
      const scale = Number(fig.style.getPropertyValue('--studio-figure-scale') || 1);
      const opacity = Number(fig.style.opacity);
      const box = fig.getBoundingClientRect();
      const rail = document.querySelector('.studio-list-wrap').getBoundingClientRect();
      const row = document.querySelector('.studio-row').getBoundingClientRect();
      const canvas = fig.querySelector('canvas').getBoundingClientRect();
      // The canvas has deliberate overscan; measure the portrait field's bottom.
      return scale >= 0.55 && scale <= 0.65 && opacity >= 0.8 && opacity <= 1
        && box.width > 24 && box.bottom > 0
        && canvas.left + canvas.width / 2 >= rail.left
        && canvas.left + canvas.width / 2 <= rail.right
        && box.top + box.height * scale <= row.top + 32;
    }, null, { timeout: 8000 });
    const later = await full.page.evaluate(() => {
      const fig = document.getElementById('figure');
      const canvas = fig.querySelector('canvas.hero-dots');
      const poseNow = {
        figures: document.querySelectorAll('#figure').length,
        canvas: fig.querySelectorAll('canvas').length,
        scale: Number(fig.style.getPropertyValue('--studio-figure-scale') || 1),
      };
      const host = new DOMMatrixReadOnly(getComputedStyle(fig).transform);
      const hostScale = Math.hypot(host.a, host.b) || 1;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const buffer = Math.abs(canvas.width - canvas.offsetWidth * dpr) <= 2;
      return { poseNow, hostScale, canvasWidth: canvas.getBoundingClientRect().width, hostWidth: fig.getBoundingClientRect().width, buffer };
    });
    assert.ok(Math.abs(later.hostScale - 1) < 0.08, `host matrix scale is ${later.hostScale}`);
    assert.ok(Math.abs(later.canvasWidth - later.hostWidth * 1.36 * later.poseNow.scale) <= 3,
      'the canvas layer carries the figure scale while preserving its native overscan');
    assert.equal(later.buffer, true, 'the dots buffer stays at full resolution');
    assert.equal(later.poseNow.figures, 1);
    assert.equal(later.poseNow.canvas, top.canvas);
    assert.deepEqual(full.errors, []);
  } finally {
    await full.context.close();
  }

  const reduced = await openPage({ reduced: true });
  try {
    const before = await reduced.page.evaluate(pose);
    assert.equal(before.lenis, false);
    assert.equal(before.slot, 'absolute');
    assert.ok(Math.abs(before.scale - 1) < 0.02);
    const start = await reduced.page.evaluate(() => scrollY);
    await reduced.page.locator('#shipgate').click();
    const samples = [];
    const begun = Date.now();
    while (Date.now() - begun < 280) {
      samples.push(await reduced.page.evaluate(() => scrollY));
      await reduced.page.waitForTimeout(20);
    }
    const end = samples[samples.length - 1];
    const glide = samples.filter(y => y > start + 4 && y < end - 4);
    assert.equal(glide.length, 0, `reduced scroll glided through ${glide.join(',')}`);
    await reduced.page.waitForFunction(() => {
      const pad = document.querySelector('.studio-header').offsetHeight;
      const top = document.getElementById('project-shipgate').getBoundingClientRect().top;
      return location.hash === '#project-shipgate' && window.SkyStudio.settled() && top >= pad - 2 && top <= pad + 36;
    });
    const after = await reduced.page.evaluate(pose);
    assert.equal(after.transform, before.transform, 'reduced portrait transform stays put while the document scrolls');
    assert.ok(Math.abs(after.scale - 1) < 0.02, `reduced scale moved to ${after.scale}`);
    assert.equal(after.slot, 'absolute');
    assert.equal(after.lenis, false);
    assert.deepEqual(reduced.errors, []);
  } finally {
    await reduced.context.close();
  }
});

test('390 and 360 compact nav underlines the selected row and fits every name', { timeout: 40000 }, async () => {
  for (const [width, height] of [[390, 844], [360, 800]]) {
    const { context, page, errors } = await openPage({ width, height, touch: true, reduced: true });
    try {
      const nav = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#studio-projects [data-studio-pick]')].map(node => {
          const box = node.getBoundingClientRect();
          return { id: node.id, top: box.top, left: box.left, width: box.width, bottom: box.bottom, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
        });
        const columns = getComputedStyle(document.querySelector('.studio-list')).gridTemplateColumns.split(' ').length;
        return { rows, columns };
      });
      assert.equal(nav.columns, 3, `${width} column count`);
      assert.equal(nav.rows.length, 3);
      assert.ok(nav.rows.every(row => Math.abs(row.top - nav.rows[0].top) <= 2), `${width} rows share a top`);
      for (const row of nav.rows) assert.ok(row.scrollWidth <= row.clientWidth + 1, `${width} ${row.id} overflows`);
      await page.locator('#airforge').click();
      await page.waitForFunction(() => {
        const marker = document.querySelector('[data-studio-marker]').getBoundingClientRect();
        const row = document.getElementById('airforge').getBoundingClientRect();
        const pad = document.querySelector('.studio-header').offsetHeight;
        const navHeight = document.querySelector('.studio-list-wrap').offsetHeight;
        const top = document.getElementById('project-airforge').getBoundingClientRect().top;
        return window.SkyStudio.slug() === 'airforge'
          && window.SkyStudio.settled()
          && Math.abs(marker.bottom - row.bottom) <= 2
          && Math.abs(marker.left - row.left) <= 2
          && Math.abs(marker.width - row.width) <= 2
          && top >= pad - 2
          && top <= pad + navHeight + 20;
      });
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
});
