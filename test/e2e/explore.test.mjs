import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';

let browser, site;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

before(async () => {
  site = await serve(root);
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    channel: process.env.CHROME_PATH ? undefined : 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
});
after(async () => { await browser?.close(); site?.server.close(); });

async function open(url = '/work/', { width = 1440, mode = 'light', reduced = true, javaScriptEnabled = true, seed } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 }, colorScheme: mode === 'light' ? 'light' : 'dark',
    reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: width < 768, isMobile: width < 768, javaScriptEnabled,
  });
  await context.addInitScript(() => sessionStorage.setItem('sky-intro', 'seen'));
  if (mode === 'gear') await context.addInitScript(() => sessionStorage.setItem('sky-gear', 'two'));
  if (seed) await context.addInitScript(seed);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(site.origin + url, { waitUntil: 'networkidle' });
  return { page, context, errors };
}

const visibleProjects = page => page.locator('.project:visible').evaluateAll(rows => rows.map(row => row.dataset.project));

test('the site index is searchable by technology and navigable without a mouse', async () => {
  const { page, context, errors } = await open();
  await page.keyboard.press('/');
  assert.equal(await page.locator('.site-index').evaluate(d => d.open), true);
  assert.equal(await page.locator('[data-index-search]').evaluate(el => el === document.activeElement), true);
  await page.locator('[data-index-search]').fill('python');
  assert.equal(await page.locator('[data-index-item]:visible').count(), 1);
  assert.equal(await page.locator('.index-projects a:visible').getAttribute('href'), '/work/recall-ai/');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '/work/recall-ai/');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/work/recall-ai/');
  assert.equal(await page.locator('h1').textContent(), 'Recall');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the index handles empty search, focus trapping, Escape, and focus restoration', async () => {
  const { page, context } = await open();
  const opener = page.locator('[data-index-open]');
  await opener.click();
  await page.locator('[data-index-search]').fill('not-a-project');
  assert.equal(await page.locator('[data-index-empty]').isVisible(), true);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('[data-index-search]').evaluate(el => el === document.activeElement), true);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.closest('dialog')?.id), 'site-index');
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.documentElement.classList.contains('index-is-open'));
  assert.equal(await opener.evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Control+k');
  assert.equal(await page.locator('.site-index').evaluate(d => d.open), true);
  await page.locator('[data-index-close]').click();
  await page.locator('[data-work-search]').focus();
  await page.keyboard.type('/');
  assert.equal(await page.locator('[data-work-search]').inputValue(), '/');
  assert.equal(await page.locator('.site-index').evaluate(d => d.open), false);
  await context.close();
});

test('the index locks the background and releases scrolling before an in-page link', async () => {
  const { page, context } = await open('/', { reduced: false });
  await page.locator('[data-index-open]').click();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis-stopped')), true);
  const y = await page.evaluate(() => scrollY);
  await page.mouse.move(80, 400);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => scrollY), y);
  await page.locator('.index-pages a[href="/#contact"]').click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('index-is-open'));
  await page.waitForFunction(() => scrollY > 500);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis-stopped')), false);
  await page.locator('[data-index-open]').click();
  await page.locator('[data-index-motion]').click();
  assert.equal(await page.locator('html').getAttribute('data-motion'), 'reduced');
  assert.equal(await page.locator('[data-index-motion-state]').textContent(), 'Reduced');
  await page.locator('[data-index-close]').click();
  assert.equal(await page.locator('[data-motion-toggle]').getAttribute('aria-pressed'), 'true');
  await context.close();
});

test('project search combines with themes, survives reload, and resets an empty result', async () => {
  const { page, context, errors } = await open('/work/?theme=developer-tools&q=python');
  assert.deepEqual(await visibleProjects(page), ['recall-ai']);
  assert.equal(await page.locator('[data-work-search]').inputValue(), 'python');
  assert.equal(await page.locator('[data-count]').textContent(), '01');
  await page.locator('[data-filter="physics-software"]').click();
  assert.deepEqual(await visibleProjects(page), []);
  assert.equal(await page.locator('[data-work-empty]').isVisible(), true);
  await page.locator('[data-clear-work]').click();
  assert.equal((await visibleProjects(page)).length, 8);
  assert.equal(new URL(page.url()).search, '');
  await page.locator('[data-work-search]').fill('TypeScript React');
  assert.deepEqual(await visibleProjects(page), ['airforge', 'spanforge', 'localpulse']);
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual(await visibleProjects(page), ['airforge', 'spanforge', 'localpulse']);
  await page.locator('[data-clear-search]').click();
  assert.equal((await visibleProjects(page)).length, 8);
  assert.equal(await page.locator('[data-work-search]').evaluate(el => el === document.activeElement), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('browser history restores filters and saved views keep matching rows', async () => {
  const { page, context } = await open();
  await page.locator('[data-filter="ai-systems"]').click();
  await page.locator('[data-filter="physics-software"]').click();
  await page.goBack();
  assert.equal(await page.locator('[data-filter="ai-systems"]').getAttribute('aria-pressed'), 'true');
  assert.equal((await visibleProjects(page)).length, 4);
  await page.goForward();
  assert.deepEqual(await visibleProjects(page), ['airforge']);
  await page.locator('button[data-work-view="grid"]').click();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('data-work-view'), 'grid');
  assert.equal(await page.locator('button[data-work-view="grid"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.project[data-project="airforge"] img').getAttribute('sizes'), '(max-width: 767px) 100vw, 50vw');
  assert.deepEqual(await visibleProjects(page), ['airforge']);
  await page.locator('button[data-work-view="list"]').click();
  await page.locator('[data-work-search]').fill('rapier');
  assert.equal(await page.locator('html').getAttribute('data-work-view'), 'list');
  assert.equal(await page.locator('.project[data-project="airforge"] img').getAttribute('sizes'), '(max-width: 767px) 50vw, 25vw');
  await context.close();
});

test('the site index and grid view stay accessible across themes and screen sizes', async () => {
  for (const width of [1440, 768, 390, 320]) for (const mode of ['light', 'dark', 'gear']) {
    const { page, context, errors } = await open('/work/', { width, mode });
    await page.locator('button[data-work-view="grid"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `grid ${width} ${mode}`);
    assert.equal(await page.locator('.projects').evaluate(el => getComputedStyle(el).display), 'grid');
    const grid = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    assert.deepEqual(grid.violations.map(v => v.id), [], `grid ${width} ${mode}`);
    await page.locator('[data-index-open]').click();
    const overflow = await page.locator('dialog').evaluate(el => el.scrollWidth - el.clientWidth);
    assert.equal(overflow, 0, `index ${width} ${mode}`);
    const dialog = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    assert.deepEqual(dialog.violations.map(v => v.id), [], `index ${width} ${mode}`);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('mobile and tablet readers can use the sticky section index without covered headings', async () => {
  for (const width of [768, 390]) for (const reduced of [false, true]) {
    const { page, context } = await open('/work/airforge/', { width, reduced });
    await page.locator('.toc').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.toc').isVisible(), true);
    await page.locator('.toc a[href="#how"]').click();
    await page.waitForFunction(() => {
      const target = document.getElementById('how').getBoundingClientRect();
      const nav = document.querySelector('.toc').getBoundingClientRect();
      return target.top >= nav.bottom && target.top <= nav.bottom + 48 && document.querySelector('.toc a[href="#how"]').getAttribute('aria-current') === 'true';
    });
    assert.equal(await page.locator('.toc a[href="#how"]').getAttribute('aria-current'), 'true');
    const progress = await page.locator('[data-reading-progress]').textContent();
    assert.ok(parseInt(progress, 10) > 0 && parseInt(progress, 10) < 100, progress);
    await context.close();
  }
});

test('copying the email reports success and offers selectable text when permission is denied', async () => {
  const { page, context } = await open('/');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedText = text; } } }));
  await page.locator('[data-copy]').click();
  assert.equal(await page.evaluate(() => window.copiedText), 'hello@aakashdahal.fun');
  assert.equal(await page.locator('[data-copy]').textContent(), 'Copied');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Permission denied'); } } }));
  await page.locator('[data-copy]').click();
  assert.equal(await page.evaluate(() => getSelection().toString()), 'hello@aakashdahal.fun');
  await page.waitForFunction(() => document.querySelector('[data-announce]').textContent.includes('unavailable'));
  await context.close();
});

test('the HTML-first portfolio remains readable with JavaScript disabled', async () => {
  const { page, context } = await open('/', { width: 390, javaScriptEnabled: false });
  assert.equal(await page.locator('h1').textContent(), 'Aakash Dahal');
  assert.equal(await page.locator('.hero-figure .still').isVisible(), true);
  assert.equal(await page.locator('[data-index-open]').isVisible(), false);
  assert.equal(await page.locator('dialog').isVisible(), false);
  await page.locator('.nav a[href="/work/"]').click();
  assert.equal((await visibleProjects(page)).length, 8);
  assert.equal(await page.locator('.work-toolbar').isVisible(), false);
  assert.equal(await page.locator('.filters').isVisible(), false);
  await context.close();
});

test('printing from an open index restores the complete page and hides navigation controls', async () => {
  const { page, context } = await open('/');
  await page.locator('[data-index-open]').click();
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('dialog').isVisible(), false);
  assert.equal(await page.locator('.hero-figure .still').isVisible(), true);
  assert.equal(await page.locator('.figure-ripple').isVisible(), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'visible');
  assert.equal(await page.locator('.contact-lines').isVisible(), true);
  await context.close();
});

test('the caption ripple button works by keyboard and follows motion and graphics availability', async () => {
  const { page, context, errors } = await open('/', { reduced: false });
  const button = page.locator('[data-hero-ripple]');
  await page.waitForFunction(() => !document.querySelector('[data-hero-ripple]').disabled);
  await button.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const gl = document.querySelector('.hero-dots').getContext('webgl2');
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    const waves = gl.getUniform(program, gl.getUniformLocation(program, 'u_rip'));
    return waves.some((n, i) => i % 4 === 3 && n > 0);
  });
  await page.locator('[data-motion-toggle]').click();
  assert.equal(await button.isDisabled(), true);
  await page.evaluate(() => {
    const gl = document.querySelector('.hero-dots').getContext('webgl2');
    window.restoreHero = gl.getExtension('WEBGL_lose_context');
    window.restoreHero.loseContext();
  });
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-fallback'));
  assert.equal(await button.isDisabled(), true);
  assert.match(await page.locator('#figure .still').evaluate(el => getComputedStyle(el).maskImage), /still\.webp/);
  await page.evaluate(() => { window.restoreHero.restoreContext(); scrollTo(0, 0); });
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live'));
  assert.equal(await page.locator('#figure .still').isVisible(), false);
  assert.deepEqual(errors, []);
  await context.close();
});
