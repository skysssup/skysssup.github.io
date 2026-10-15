import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';

let browser, site;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
  await context.addInitScript(m => localStorage.setItem('sky-theme', m === 'light' ? 'light' : 'dark'), mode);
  if (mode === 'gear') await context.addInitScript(() => sessionStorage.setItem('sky-gear', 'two'));
  if (mode === 'blue') await context.addInitScript(() => sessionStorage.setItem('sky-gear', 'blue'));
  if (seed) await context.addInitScript(seed);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(site.origin + url, { waitUntil: 'networkidle' });
  return { page, context, errors };
}

const visibleProjects = page => page.locator('.project:visible').evaluateAll(rows => rows.map(row => row.dataset.project));

async function contactReached(page) {
  await page.waitForFunction(() => {
    const contact = document.getElementById('contact');
    const header = document.querySelector('.studio-header');
    if (!contact || !header || location.hash !== '#contact' || window.SkyStudio?.slug() !== 'contact') return false;
    const headerBottom = header.getBoundingClientRect().bottom;
    const box = contact.getBoundingClientRect();
    const desired = box.top + scrollY - (headerBottom + 8);
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const reachable = Math.min(Math.max(0, desired), maxScroll);
    const fullyVisible = node => {
      const rect = node.getBoundingClientRect();
      return rect.height > 0 && rect.top >= headerBottom - 1 && rect.bottom <= innerHeight + 1;
    };
    const copy = contact.querySelector('[data-copy]');
    const mail = contact.querySelector('a[href^="mailto:"]');
    return Math.abs(scrollY - reachable) <= 2
      && box.top >= headerBottom - 1
      && box.bottom <= innerHeight + 1
      && copy && mail && fullyVisible(copy) && fullyVisible(mail);
  });
}

test('the site index is searchable by technology and navigable without a mouse', async () => {
  const { page, context, errors } = await open();
  await page.keyboard.press('/');
  assert.equal(await page.locator('.site-index').evaluate(d => d.open), true);
  assert.equal(await page.locator('[data-index-search]').evaluate(el => el === document.activeElement), true);
  await page.locator('[data-index-search]').fill('rapier');
  assert.equal(await page.locator('[data-index-item]:visible').count(), 1);
  assert.equal(await page.locator('.index-projects a:visible').getAttribute('href'), '/work/airforge/');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '/work/airforge/');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/work/airforge/');
  assert.equal(await page.locator('h1').textContent(), 'AirForge');
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
  await page.waitForFunction(() => window.SkyStudio?.settled());
  await page.locator('[data-index-open]').click();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('index-is-open')), true);
  const y = await page.evaluate(() => scrollY);
  await page.mouse.move(80, 400);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => scrollY), y);
  await page.locator('.index-pages a[href="/#contact"]').click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('index-is-open'));
  await contactReached(page);
  assert.equal(await page.evaluate(() => window.SkyStudio.settled()), true);
  await page.locator('[data-index-open]').click();
  await page.locator('[data-index-motion]').click();
  assert.equal(await page.locator('html').getAttribute('data-motion'), 'reduced');
  assert.equal(await page.locator('[data-index-motion-state]').textContent(), 'Reduced');
  await page.locator('[data-index-close]').click();
  assert.equal(await page.locator('[data-motion-toggle]').getAttribute('aria-pressed'), 'true');
  await context.close();
});

test('project search combines with themes, survives reload, and resets an empty result', async () => {
  const { page, context, errors } = await open('/work/?theme=developer-tools&q=git');
  assert.deepEqual(await visibleProjects(page), ['shipgate']);
  assert.equal(await page.locator('[data-work-search]').inputValue(), 'git');
  assert.equal(await page.locator('[data-count]').textContent(), '01');
  await page.locator('[data-filter="physics-software"]').click();
  assert.deepEqual(await visibleProjects(page), []);
  assert.equal(await page.locator('[data-work-empty]').isVisible(), true);
  await page.locator('[data-clear-work]').click();
  assert.equal((await visibleProjects(page)).length, 3);
  assert.equal(new URL(page.url()).search, '');
  await page.locator('[data-work-search]').fill('TypeScript React');
  assert.deepEqual(await visibleProjects(page), ['airforge']);
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual(await visibleProjects(page), ['airforge']);
  await page.locator('[data-clear-search]').click();
  assert.equal((await visibleProjects(page)).length, 3);
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
  assert.equal((await visibleProjects(page)).length, 1);
  await page.goForward();
  assert.deepEqual(await visibleProjects(page), ['airforge']);
  await page.locator('button[data-work-view="grid"]').click();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('data-work-view'), 'grid');
  assert.equal(await page.locator('button[data-work-view="grid"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.project[data-project="airforge"] h2 a').getAttribute('href'), '/work/airforge/');
  assert.deepEqual(await visibleProjects(page), ['airforge']);
  await page.locator('button[data-work-view="list"]').click();
  await page.locator('[data-work-search]').fill('rapier');
  assert.equal(await page.locator('html').getAttribute('data-work-view'), 'list');
  assert.equal(await page.locator('.project[data-project="airforge"] img').count(), 0);
  await context.close();
});

test('the site index and grid view stay accessible across themes and screen sizes', async () => {
  for (const width of [1440, 768, 390, 320]) for (const mode of ['light', 'dark', 'gear', 'blue']) {
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
  await page.locator('a[href="#contact"]').first().click();
  await contactReached(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedText = text; } } }));
  await page.locator('#contact [data-copy]').click();
  assert.equal(await page.evaluate(() => window.copiedText), 'hello@aakashdahal.fun');
  assert.equal(await page.locator('[data-copy]').textContent(), 'Copied');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Permission denied'); } } }));
  await page.locator('#contact [data-copy]').click();
  assert.equal(await page.evaluate(() => getSelection().toString()), 'hello@aakashdahal.fun');
  await page.waitForFunction(() => document.querySelector('[data-announce]').textContent.includes('unavailable'));
  await context.close();
});

test('the HTML-first portfolio remains readable with JavaScript disabled', async () => {
  const { page, context } = await open('/', { width: 390, javaScriptEnabled: false });
  assert.equal(await page.locator('h1').textContent(), 'Aakash Dahal');
  assert.equal(await page.locator('.hero-figure .still').isVisible(), true);
  assert.equal(await page.locator('[data-studio-pick]').count(), 3);
  assert.equal(await page.locator('article.work-card').count(), 3);
  assert.equal(await page.locator('#about').count(), 1);
  assert.equal(await page.locator('#contact').count(), 1);
  assert.equal(await page.locator('a[href="mailto:hello@aakashdahal.fun"]').count(), 1);
  for (const slug of ['agentcrucible', 'airforge', 'shipgate']) {
    const href = `/work/${slug}/`;
    assert.ok(await page.locator(`a[href="${href}"]`).count() >= 1, href);
    assert.equal((await page.request.get(site.origin + href)).status(), 200, href);
    assert.equal(await page.locator(`#${slug}`).getAttribute('href'), `#project-${slug}`);
  }
  for (const sel of ['[data-index-open]', '[data-studio-picker]', 'button[data-studio-zoom]', '[data-studio-evidence-zoom]', '[data-scene-action]', '[data-gear-neutral]', '[data-gear-toggle]', '[data-gear-blue]', '[data-motion-toggle]', '[data-lamp]', '[data-copy]', '[data-bench-live]', 'dialog']) {
    assert.equal(await page.locator(`${sel}:visible`).count(), 0, `${sel} must not offer a dead control without JavaScript`);
  }
  await page.locator('#work-list a[href="/work/"]').click();
  assert.equal((await visibleProjects(page)).length, 3);
  assert.equal(await page.locator('.work-toolbar').isVisible(), false);
  assert.equal(await page.locator('.filters').isVisible(), false);
  await context.close();
});

test('printing from an open index restores the complete page and hides navigation controls', async () => {
  const { page, context } = await open('/');
  await page.locator('[data-index-open]').click();
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('#site-index').isVisible(), false);
  assert.equal(await page.locator('.hero-figure .still').isVisible(), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'visible');
  assert.equal(await page.locator('[data-studio-panel="contact"]').isVisible(), true);
  await context.close();
});

test('the caption offers no lightning to call down, and the still covers the figure while graphics are lost', async () => {
  const { page, context, errors } = await open('/', { reduced: false });
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live'));
  assert.equal(await page.locator('[data-hero-ripple]').count(), 0);
  assert.equal(await page.locator('.fig-note').count(), 0);
  const box = await page.locator('#figure').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => {
    const gl = document.querySelector('.hero-dots').getContext('webgl2');
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    const waves = gl.getUniform(program, gl.getUniformLocation(program, 'u_rip'));
    return waves.every((n, i) => i % 4 !== 3 || n === 0);
  }), 'a click calls down no lightning');
  await page.locator('[data-motion-toggle]').click();
  await page.evaluate(() => {
    const gl = document.querySelector('.hero-dots').getContext('webgl2');
    window.restoreHero = gl.getExtension('WEBGL_lose_context');
    window.restoreHero.loseContext();
  });
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-fallback'));
  assert.match(await page.locator('#figure .still').evaluate(el => getComputedStyle(el).maskImage), /still\.webp/);
  await page.evaluate(() => { window.restoreHero.restoreContext(); scrollTo(0, 0); });
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live'));
  assert.equal(await page.locator('#figure .still').isVisible(), false);
  assert.deepEqual(errors, []);
  await context.close();
});
