import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pages = ['/#agentcrucible', '/work/', '/work/agentcrucible/', '/work/airforge/', '/work/shipgate/'];
const projectNames = ['AgentCrucible', 'AirForge', 'Shipgate'];

let browser, site;
before(async () => {
  site = await serve(root);
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
});
after(async () => { await browser?.close(); site?.server.close(); });

async function withPage(options, run) {
  const stamp = fs.mkdtempSync(path.join(os.tmpdir(), 'sky-finish-'));
  const context = await browser.newContext({
    viewport: { width: options.width || 1440, height: options.height || 900 },
    reducedMotion: options.reduced === false ? 'no-preference' : 'reduce',
    hasTouch: !!options.touch,
    isMobile: !!options.touch,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    acceptDownloads: false,
  });
  try {
    await context.addInitScript(dir => sessionStorage.setItem('sky-finish-context', dir), stamp);
    await context.addInitScript(() => sessionStorage.setItem('sky-intro', 'seen'));
    await context.addInitScript(() => {
      window.portraitDraws = 0;
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas && this.canvas.classList && this.canvas.classList.contains('hero-dots')) window.portraitDraws++;
        return draw.apply(this, args);
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(site.origin + (options.url || '/work/'), { waitUntil: 'domcontentloaded' });
    await run(page, errors);
  } finally {
    await context.close();
  }
}

const settle = page => page.waitForFunction(() => window.SkyStudio && SkyStudio.settled());
const readyBench = page => page.waitForFunction(() => document.querySelector('[data-studio].is-ready') && window.SkyStudio && SkyStudio.settled());

async function rowLayout(page) {
  return page.locator('[data-studio-pick]').evaluateAll(rows => rows.map(row => {
    const box = row.getBoundingClientRect();
    return { id: row.id, top: box.top, left: box.left, width: box.width, height: box.height, nodeScroll: row.scrollWidth, text: row.querySelector('span')?.textContent || '' };
  }));
}

test('site index clear restores results, keeps the dialog expanded, and Escape returns focus', async () => {
  await withPage({ url: '/work/' }, async (page, errors) => {
    const opener = page.locator('[data-index-open]');
    const dialog = page.locator('#site-index');
    const search = page.locator('[data-index-search]');
    const clear = page.locator('[data-index-clear]');
    assert.equal(await opener.getAttribute('aria-expanded'), 'false');
    assert.equal(await clear.isVisible(), false);

    await opener.click();
    assert.equal(await dialog.evaluate(el => el.open), true);
    assert.equal(await opener.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#site-index').open);
    assert.equal(await opener.getAttribute('aria-expanded'), 'false');
    assert.equal(await opener.evaluate(el => el === document.activeElement), true);

    const contact = page.locator('nav.nav a[href="/#contact"]');
    await contact.focus();
    await page.keyboard.press('/');
    assert.equal(await opener.getAttribute('aria-expanded'), 'true');
    assert.equal(await dialog.evaluate(el => el.open), true);
    const all = await page.locator('[data-index-item]:visible').count();
    await search.fill('AirForge');
    await page.waitForFunction(() => document.querySelector('[data-index-status]').textContent.includes('result'));
    const filtered = await page.locator('[data-index-item]:visible').count();
    assert.ok(filtered > 0 && filtered < all, `AirForge should narrow the index (${filtered} of ${all})`);
    assert.equal(await page.locator('[data-index-item]:visible').evaluateAll(nodes => nodes.some(node => /AirForge/.test(node.textContent))), true);
    assert.equal(await clear.isVisible(), true);
    const box = await clear.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, 'clear control is a visible target');
    await clear.click();
    assert.equal(await search.inputValue(), '');
    assert.equal(await search.evaluate(el => el === document.activeElement), true);
    assert.equal(await clear.isVisible(), false);
    assert.equal(await dialog.evaluate(el => el.open), true);
    assert.equal(await opener.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('[data-index-item]:visible').count(), all);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#site-index').open);
    assert.equal(await opener.getAttribute('aria-expanded'), 'false');
    assert.equal(await contact.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(errors, []);
  });
});

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
    const placed = await page.evaluate(name => {
      const header = document.querySelector('.studio-header');
      const pad = header ? header.offsetHeight : 0;
      const line = pad + (innerHeight - pad) * 0.34;
      const order = ['agentcrucible', 'airforge', 'shipgate'];
      const box = document.getElementById(`project-${name}`).getBoundingClientRect();
      const idx = order.indexOf(name);
      const next = idx < order.length - 1
        ? document.getElementById(`project-${order[idx + 1]}`)
        : document.getElementById('contact');
      const nextTop = next.getBoundingClientRect().top;
      return { placed: box.top <= line + 1 && nextTop > line + 1, above: nextTop <= line + 1 };
    }, slug);
    if (placed.placed) return;
    await page.mouse.wheel(0, placed.above ? -560 : 560);
  }
  throw new Error(`#project-${slug} never settled in the viewing band`);
}

test('three upright rows keep selection, the shown article, and the marker on the project in view', async () => {
  await withPage({ url: '/', reduced: false }, async (page, errors) => {
    await readyBench(page);
    assert.equal(await page.locator('[data-studio-wheel], [data-studio-picker], [data-studio-step]').count(), 0);
    assert.equal(await page.locator('#figure').count(), 1);
    const figure = await page.locator('#figure').boundingBox();
    const stage = await page.locator('#hero').boundingBox();
    assert.ok(figure && Math.abs((figure.x + figure.width / 2) - (stage.x + stage.width / 2)) <= 24, 'avatar stays centered on its mounted node');
    const before = await page.evaluate(() => scrollY);
    await page.mouse.move(stage.x + 8, stage.y + Math.min(stage.height - 8, 200));
    await page.mouse.wheel(0, 480);
    await page.waitForFunction(start => scrollY > start, before);
    await wheelToArticle(page, 'airforge');
    await page.waitForFunction(() => {
      const header = document.querySelector('.studio-header');
      const pad = header ? header.offsetHeight : 0;
      const line = pad + (innerHeight - pad) * 0.34;
      const article = document.getElementById('project-airforge').getBoundingClientRect();
      const next = document.getElementById('project-shipgate').getBoundingClientRect().top;
      const marker = document.querySelector('[data-studio-marker]').getBoundingClientRect().top;
      const row = document.getElementById('airforge').getBoundingClientRect().top;
      const selected = document.querySelector('[aria-selected="true"]');
      return SkyStudio.slug() === 'airforge'
        && SkyStudio.settled()
        && selected && selected.id === 'airforge'
        && document.getElementById('project-airforge').classList.contains('is-shown')
        && article.top <= line + 1 && next > line + 1
        && Math.abs(marker - row) <= 2;
    });
    const rows = await rowLayout(page);
    assert.deepEqual(rows.map(row => row.text), projectNames);
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i].top >= rows[i - 1].top + rows[i - 1].height - 1, `${rows[i].id} is not below ${rows[i - 1].id}`);
      assert.ok(Math.abs(rows[i].left - rows[0].left) <= 2, `${rows[i].id} left the row column`);
    }
    const committedHash = await page.evaluate(() => location.hash);
    await page.locator('#shipgate').hover();
    await page.waitForTimeout(80);
    assert.equal(await page.locator('#airforge').getAttribute('aria-selected'), 'true', 'hover does not steal the commit');
    assert.equal(await page.evaluate(() => location.hash), committedHash);
    assert.equal(await page.locator('#project-airforge').evaluate(node => node.classList.contains('is-shown')), true);
    await page.mouse.move(8, 8);
    await page.locator('#airforge').click();
    await settle(page);
    assert.equal(await page.locator('#airforge').getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'airforge');
    assert.equal(await page.evaluate(() => SkyStudio.selected()), 2);
    await page.locator('#airforge').focus();
    await page.keyboard.press('End');
    await settle(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'shipgate');
    await page.keyboard.press('ArrowDown');
    await settle(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'shipgate', 'the list does not wrap into contact');
    await page.keyboard.press('Home');
    await settle(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible');
    await page.keyboard.press('ArrowUp');
    await settle(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible', 'the list does not wrap into about');
    assert.equal(await page.locator('#about').evaluate(el => el.tagName), 'SPAN');
    assert.equal(await page.locator('[data-studio-panel="about"]').evaluate(el => el.classList.contains('studio-identity')), true);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('#figure').count(), 1);
    assert.equal(await page.locator('#contact').evaluate(el => el.tagName), 'SECTION');
    assert.deepEqual(errors, []);
  });
});


test('narrow rows stay in three columns across resize and keyboard endpoints', async () => {
  await withPage({ url: '/#agentcrucible', width: 390, height: 800, touch: true }, async (page, errors) => {
    await readyBench(page);
    const rows = await rowLayout(page);
    assert.equal(rows.length, 3);
    assert.ok(rows.every(row => Math.abs(row.top - rows[0].top) <= 2), '390 nav shares one row');
    assert.ok(rows[1].left > rows[0].left + 8 && rows[2].left > rows[1].left + 8, '390 nav is three columns');
    for (const row of rows) assert.ok(row.nodeScroll <= row.width + 1, `${row.id} name overflows`);
    await page.locator('#agentcrucible').focus();
    await page.keyboard.press('End');
    await settle(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'shipgate');
    const selected = await page.locator('#shipgate').boundingBox();
    const view = page.viewportSize();
    assert.ok(selected.y >= 0 && selected.y + selected.height <= view.height + 1, 'End keeps the last row in view');
    await page.locator('#agentcrucible').click();
    await settle(page);
    assert.equal(await page.locator('#project-agentcrucible .work-card-name').innerText(), 'AgentCrucible');
    await page.locator('#shipgate').click();
    await settle(page);
    assert.equal(await page.locator('#project-shipgate .work-card-name').innerText(), 'Shipgate');
    assert.equal(await page.locator('#project-shipgate').evaluate(node => node.classList.contains('is-shown') && node.inert === false), true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `narrow home overflows by ${overflow}px`);
    assert.deepEqual(errors, []);
  });
});

test('a native touch drag scrolls the article column', async () => {
  await withPage({ url: '/', width: 390, height: 800, touch: true, reduced: false }, async (page, errors) => {
    await readyBench(page);
    const before = await page.evaluate(() => scrollY);
    const view = page.viewportSize();
    const client = await page.context().newCDPSession(page);
    const x = view.width / 2;
    const y = view.height * 0.72;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 280, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(start => scrollY > start + 40, before);
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction), 'none');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `touch home overflows by ${overflow}px`);
    assert.deepEqual(errors, []);
  });
});

test('resizing during keyboard selection keeps the requested project', async () => {
  await withPage({ url: '/#agentcrucible', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await page.locator('#airforge').click();
    await settle(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'airforge');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#airforge').focus();
    await page.keyboard.press('End');
    await page.setViewportSize({ width: 391, height: 844 });
    await page.waitForFunction(() => SkyStudio.slug() === 'shipgate' && SkyStudio.settled());
    await page.setViewportSize({ width: 768, height: 844 });
    await page.waitForFunction(() => SkyStudio.slug() === 'shipgate' && SkyStudio.settled() && document.querySelector('#shipgate').getAttribute('aria-selected') === 'true');
    const rows = await rowLayout(page);
    for (let i = 1; i < rows.length; i++) assert.ok(Math.abs(rows[i].left - rows[0].left) <= 2);
    assert.deepEqual(errors, []);
  });
});

test('narrow pages do not grow a horizontal scrollbar', async () => {
  await withPage({ url: '/work/', width: 390, height: 800, touch: true }, async (page, errors) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      for (const url of pages) {
        await page.goto(site.origin + url, { waitUntil: 'domcontentloaded' });
        if (url.startsWith('/#')) await readyBench(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `${url} at ${width}px overflows by ${overflow}px`);
      }
    }
    assert.deepEqual(errors, []);
  });
});

test('opening a local lab, changing selection, and toggling examples stays on the mounted project', async () => {
  await withPage({ url: '/#agentcrucible' }, async (page, errors) => {
    await readyBench(page);
    const lab = page.locator('#project-agentcrucible details.studio-lab');
    assert.equal(await lab.evaluate(el => el.open), false);
    await lab.locator('summary').click();
    assert.equal(await lab.evaluate(el => el.open), true);
    assert.equal(await page.locator('#project-agentcrucible [data-project-lab]').isVisible(), true);
    const before = await page.evaluate(() => SkyStudio.snapshot());
    assert.equal(before.slug, 'agentcrucible');
    await page.locator('[data-bench-live]').click();
    assert.equal(await page.locator('[data-bench-live]').getAttribute('aria-pressed'), 'false');
    await page.locator('#shipgate').click();
    await settle(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'shipgate');
    assert.equal(await page.locator('#project-agentcrucible').evaluate(el => el.inert), false);
    assert.equal(await page.locator('#project-agentcrucible').evaluate(el => el.isConnected), true);
    assert.equal(await page.locator('#project-shipgate details.studio-lab').evaluate(el => el.open), false);
    await page.locator('#project-shipgate details.studio-lab summary').click();
    assert.equal(await page.locator('#project-shipgate [data-project-lab]').isVisible(), true);
    assert.equal(await page.evaluate(() => SkyStudio.snapshot().slug), 'shipgate');
    assert.deepEqual(errors, []);
  });
});

test('the evidence viewer moves the mounted media node and returns it with focus', async () => {
  await withPage({ url: '/#airforge', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await wheelToArticle(page, 'airforge');
    const opener = page.locator('#project-airforge [data-studio-evidence-zoom]');
    const video = page.locator('#project-airforge [data-studio-video]');
    assert.equal(await video.getAttribute('controls'), '');
    await page.waitForFunction(() => {
      const node = document.querySelector('#project-airforge [data-studio-video]');
      return node && !node.paused;
    });
    await opener.click();
    await page.waitForFunction(() => {
      const viewer = document.getElementById('studio-viewer');
      return viewer && viewer.open
        && viewer.querySelectorAll('[data-studio-video]').length === 1
        && document.querySelectorAll('#project-airforge [data-studio-video]').length === 0;
    });
    assert.equal(await page.locator('#studio-viewer [data-studio-video]').count(), 1);
    assert.equal(await page.locator('#project-airforge [data-studio-video]').count(), 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const viewer = document.getElementById('studio-viewer');
      const opener = document.querySelector('#project-airforge [data-studio-evidence-zoom]');
      return viewer && !viewer.open
        && document.querySelectorAll('#project-airforge [data-studio-video]').length === 1
        && document.querySelectorAll('#studio-viewer [data-studio-video]').length === 0
        && document.activeElement === opener;
    });
    assert.equal(await page.locator('#project-airforge [data-studio-video]').count(), 1);
    assert.equal(await opener.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(errors, []);
  });
});

test('a native pause on the studio video stays paused when the clip returns', async () => {
  await withPage({ url: '/#airforge', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await wheelToArticle(page, 'airforge');
    const video = page.locator('#project-airforge [data-studio-video]');
    await page.waitForFunction(() => {
      const node = document.querySelector('#project-airforge [data-studio-video]');
      return node && !node.paused;
    }, null, { timeout: 8000 });
    const box = await video.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-studio-video]').paused);
    for (let step = 0; step < 12; step += 1) {
      await waitLenisIdle(page);
      const gone = await page.evaluate(() => document.getElementById('project-airforge').getBoundingClientRect().bottom < 0);
      if (gone) break;
      await page.mouse.wheel(0, 640);
    }
    await waitLenisIdle(page);
    await page.waitForFunction(() => document.getElementById('project-airforge').getBoundingClientRect().bottom < 0);
    await wheelToArticle(page, 'airforge');
    assert.equal(await video.evaluate(node => node.paused), true, 'a real pause must survive leaving and re-entering the viewport');
    await video.focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('#project-airforge [data-studio-video]').paused);
    assert.deepEqual(errors, []);
  });
});

test('a hidden document pauses the selected recording and other recordings stay paused', async () => {
  await withPage({ url: '/#airforge', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await wheelToArticle(page, 'airforge');
    await page.waitForTimeout(400);
    const others = await page.locator('[data-studio-video]').evaluateAll(nodes => nodes.filter(node => node.closest('#project-airforge') == null).every(node => node.paused));
    assert.equal(others, true);
    const other = await page.context().newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await page.waitForTimeout(300);
    let hidden = await page.evaluate(() => document.visibilityState === 'hidden');
    const client = await page.context().newCDPSession(page);
    if (!hidden) {
      // `hidden` is not a CDP lifecycle state. `frozen` is, and it does not hang the read.
      await client.send('Page.setWebLifecycleState', { state: 'frozen' });
      const read = await client.send('Runtime.evaluate', {
        expression: 'document.visibilityState',
        returnByValue: true,
      });
      hidden = read.result && read.result.value === 'hidden';
      await client.send('Page.setWebLifecycleState', { state: 'active' });
    }
    await other.close();
    if (hidden) {
      assert.equal(await page.locator('#project-airforge [data-studio-video]').evaluate(el => el.paused), true);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('page-hidden')), true);
    } else {
      // Headless Chrome stays visible for a background page and for lifecycle `frozen`.
      // The pause-on-hidden path cannot run here. Do not synthesize document.hidden.
      assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
    }
    assert.deepEqual(errors, []);
  });
});

test('selection still resolves when the preview starts below a short viewport', async () => {
  await withPage({ url: '/', reduced: false, height: 480 }, async (page, errors) => {
    await readyBench(page);
    await page.locator('#shipgate').click();
    await page.waitForFunction(() => {
      const header = document.querySelector('.studio-header');
      const pad = header ? header.offsetHeight : 0;
      const box = document.getElementById('project-shipgate').getBoundingClientRect();
      return SkyStudio.selected() === 3 && SkyStudio.settled() && SkyStudio.slug() === 'shipgate' && box.top >= pad - 2 && box.top <= pad + 36;
    });
    assert.equal(await page.locator('#project-shipgate.is-shown').count(), 1);
    assert.equal(await page.locator('#shipgate').getAttribute('aria-selected'), 'true');
    assert.deepEqual(errors, []);
  });
  await withPage({ url: '/', width: 390, height: 800, touch: true }, async (page, errors) => {
    await readyBench(page);
    await page.locator('#shipgate').click();
    await page.waitForFunction(() => SkyStudio.slug() === 'shipgate' && SkyStudio.settled());
    assert.equal(await page.locator('#shipgate').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#project-shipgate.is-shown').count(), 1);
    assert.equal(await page.locator('[data-studio-picker]').count(), 0);
    assert.deepEqual(errors, []);
  });
});
