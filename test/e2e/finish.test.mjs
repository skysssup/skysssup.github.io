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
const projectNames = ['AgentCrucible', 'AirForge', 'Shipgate', 'Recall', 'Spanforge', 'LocalPulse', 'Ghost Notetaker', 'Shipgate'];

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
    return { id: row.id, top: box.top, left: box.left, width: box.width, height: box.height, text: row.querySelector('span')?.textContent || '' };
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
    await search.fill('python');
    await page.waitForFunction(() => document.querySelector('[data-index-status]').textContent.includes('result'));
    const filtered = await page.locator('[data-index-item]:visible').count();
    assert.ok(filtered > 0 && filtered < all, `python should narrow the index (${filtered} of ${all})`);
    assert.equal(await page.locator('[data-index-item]:visible').evaluateAll(nodes => nodes.some(node => /Recall/i.test(node.textContent))), true);
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

test('three upright rows keep selection, preview, and the marker on the same project while the page still scrolls', async () => {
  await withPage({ url: '/', reduced: false }, async (page, errors) => {
    await readyBench(page);
    assert.equal(await page.locator('[data-studio-wheel], [data-studio-picker], [data-studio-step]').count(), 0);
    assert.equal(await page.locator('#figure').count(), 1);
    const figure = await page.locator('#figure').boundingBox();
    const stage = await page.locator('#hero').boundingBox();
    assert.ok(figure && Math.abs((figure.x + figure.width / 2) - (stage.x + stage.width / 2)) <= 24, 'avatar stays centered on its mounted node');
    const before = await page.evaluate(() => scrollY);
    await page.mouse.move(stage.x + 8, stage.y + stage.height - 8);
    await page.mouse.wheel(0, 480);
    await page.waitForFunction(start => scrollY > start, before);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible', 'a page-wheel gesture must not change the project');
    const rows = await rowLayout(page);
    assert.deepEqual(rows.map(row => row.text), projectNames);
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i].top >= rows[i - 1].top + rows[i - 1].height - 1, `${rows[i].id} is not below ${rows[i - 1].id}`);
      assert.ok(Math.abs(rows[i].left - rows[0].left) <= 2, `${rows[i].id} left the row column`);
    }
    await page.locator('#airforge').hover();
    await page.waitForTimeout(80);
    const preview = await page.evaluate(() => {
      const row = document.querySelector('.studio-row.is-preview');
      const panel = document.querySelector('.work-card.is-shown');
      const marker = document.querySelector('[data-studio-marker]');
      const shift = new DOMMatrix(marker.style.transform || 'none').f;
      return { row: row.id, panel: panel.dataset.studioPanel, marker: Math.abs(shift - row.offsetTop) };
    });
    assert.equal(preview.row, 'airforge');
    assert.equal(preview.panel, 'airforge');
    assert.ok(preview.marker <= 8, `marker left the preview row by ${preview.marker}px`);
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


test('narrow rows stay upright across resize and keyboard endpoints', async () => {
  await withPage({ url: '/#agentcrucible', width: 390, height: 800, touch: true }, async (page, errors) => {
    await readyBench(page);
    const rows = await rowLayout(page);
    assert.equal(rows.length, 3);
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i].top >= rows[i - 1].top + rows[i - 1].height - 1);
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
    assert.equal(await page.locator('#project-shipgate.is-shown .work-card-name').innerText(), 'Shipgate');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `narrow home overflows by ${overflow}px`);
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
    assert.equal(await page.locator('#project-agentcrucible').evaluate(el => el.inert), true);
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
    const opener = page.locator('#project-airforge [data-studio-evidence-zoom]');
    const video = page.locator('#project-airforge [data-studio-video]');
    assert.equal(await video.getAttribute('controls'), '');
    await page.waitForFunction(() => {
      const node = document.querySelector('#project-airforge [data-studio-video]');
      return node && !node.paused;
    });
    await opener.click();
    await page.waitForFunction(() => document.getElementById('studio-viewer').open);
    assert.equal(await page.locator('#studio-viewer [data-studio-video]').count(), 1);
    assert.equal(await page.locator('#project-airforge [data-studio-video]').count(), 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('studio-viewer').open);
    assert.equal(await page.locator('#project-airforge [data-studio-video]').count(), 1);
    assert.equal(await opener.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(errors, []);
  });
});

test('a native pause on the studio video stays paused when the clip returns', async () => {
  await withPage({ url: '/#airforge', reduced: false }, async (page, errors) => {
    await readyBench(page);
    const video = page.locator('#project-airforge [data-studio-video]');
    await video.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const node = document.querySelector('#project-airforge [data-studio-video]');
      return node && !node.paused;
    }, null, { timeout: 8000 });
    await video.focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-studio-video]').paused);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await video.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
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
    await page.locator('#project-airforge [data-studio-video]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const others = await page.locator('[data-studio-video]').evaluateAll(nodes => nodes.filter(node => node.closest('#project-airforge') == null).every(node => node.paused));
    assert.equal(others, true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get() { return true; } });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => document.documentElement.classList.contains('page-hidden'));
    assert.equal(await page.locator('#project-airforge [data-studio-video]').evaluate(el => el.paused), true);
    assert.equal(await page.evaluate(() => window.portraitDraws === 0 || document.documentElement.classList.contains('page-hidden')), true);
    assert.deepEqual(errors, []);
  });
});

test('selection still resolves when the preview starts below a short viewport', async () => {
  await withPage({ url: '/', reduced: false, height: 480 }, async (page, errors) => {
    await readyBench(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.evaluate(() => SkyStudio.select(4));
    await page.waitForFunction(() => SkyStudio.selected() === 3 && SkyStudio.settled() && SkyStudio.slug() === 'shipgate');
    assert.equal(await page.locator('#project-shipgate.is-shown').count(), 1);
    assert.equal(await page.locator('#shipgate').getAttribute('aria-selected'), 'true');
    assert.deepEqual(errors, []);
  });
  await withPage({ url: '/', width: 390, height: 800, touch: true }, async (page, errors) => {
    await readyBench(page);
    await page.evaluate(() => SkyStudio.selectSlug('shipgate'));
    await page.waitForFunction(() => SkyStudio.slug() === 'shipgate' && SkyStudio.settled());
    assert.equal(await page.locator('#shipgate').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#project-shipgate.is-shown').count(), 1);
    assert.equal(await page.locator('[data-studio-picker]').count(), 0);
    assert.deepEqual(errors, []);
  });
});
