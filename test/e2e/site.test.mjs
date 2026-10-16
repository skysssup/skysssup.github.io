// End-to-end checks in Chromium: every page at four widths in light, dark, Gear Two, and Tide, with axe-core,
// plus the interactions. Run with `npm run test:e2e` (CHROME_PATH may point at a local Chrome).
// SHOTS=<dir> also saves a screenshot of every page/width/mode; LINKS=1 checks external links too.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const slugs = fs.readdirSync(path.join(root, 'work')).filter(d => fs.existsSync(path.join(root, 'work', d, 'index.html')));
const PAGES = (process.env.PAGES ? process.env.PAGES.split(',') : ['/', '/work/', ...slugs.map(s => `/work/${s}/`), '/missing-page']);
const WIDTHS = [[1440, 900], [768, 1024], [390, 844], [360, 800]];
const MODES = ['light', 'dark', 'gear', 'blue'];
const SHOTS = process.env.SHOTS;
let browser, site;

before(async () => {
  site = await serve(root);
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    channel: process.env.CHROME_PATH ? undefined : 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
});
after(async () => { await browser?.close(); site?.server.close(); });

async function open(url, { width = 1440, height = 900, mode = 'light', reduced = false, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: mode === 'light' ? 'light' : 'dark', reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: touch, isMobile: touch });
  await context.addInitScript(m => {
    try {
      if (!sessionStorage.getItem('e2e-seeded')) {
        sessionStorage.setItem('e2e-seeded', '1');
        sessionStorage.setItem('sky-intro', 'seen');
        localStorage.setItem('sky-theme', m === 'light' ? 'light' : 'dark');
        if (m === 'gear') sessionStorage.setItem('sky-gear', 'two');
        if (m === 'blue') sessionStorage.setItem('sky-gear', 'blue');
      }
    } catch (e) {}
  }, mode);
  const page = await context.newPage();
  const problems = [];
  page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`console.${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', err => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', req => { if (!/\.mp4$/.test(req.url())) problems.push(`failed: ${req.url()} ${req.failure()?.errorText}`); });
  page.on('response', res => { if (res.status() >= 400 && !res.url().endsWith('/missing-page')) problems.push(`HTTP ${res.status()}: ${res.url()}`); });
  await page.goto(site.origin + url, { waitUntil: 'networkidle' });
  return { page, context, problems };
}

test('every page loads cleanly at every width in light, dark, Gear Two, and Tide', async () => {
  for (const url of PAGES) for (const [width, height] of WIDTHS) for (const mode of MODES) {
    const { page, context, problems } = await open(url, { width, height, mode, touch: width < 768 });
    await page.waitForTimeout(url === '/' ? 1800 : 300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `${url} ${width} ${mode} overflows by ${overflow}px`);
    const unexpected = url === '/missing-page' ? problems.filter(p => !/status of 404/.test(p)) : problems;
    assert.deepEqual(unexpected, [], `${url} ${width} ${mode}`);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-gear')), { gear: 'two', blue: 'blue' }[mode] || null);
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `${url.replace(/\//g, '_').replace(/^_|_$/g, '') || 'home'}-${width}-${mode}.png`), fullPage: true });
    }
    await context.close();
  }
});

test('axe finds no accessibility violations at any width in any mode', async () => {
  for (const url of PAGES) for (const [width, height] of WIDTHS) for (const mode of MODES) {
    const { page, context } = await open(url, { width, height, mode, touch: width < 768 });
    await page.waitForTimeout(url === '/' ? 2200 : 400);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const found = result.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
    assert.deepEqual(found, [], `${url} ${width} ${mode}`);
    await context.close();
  }
});

test('content rails stay inside the viewport across pages and screen sizes', async () => {
  for (const url of PAGES) for (const [width, height] of WIDTHS) {
    const { page, context } = await open(url, { width, height, touch: width < 768 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, url + ' ' + width);
    if (url === '/' && (width === 1440 || width === 768)) {
      const studio = await page.locator('[data-studio]').boundingBox();
      assert.ok(Math.abs(studio.width - width) <= 2, `studio shell ${width} is ${studio.width}, expected full bleed ${width}`);
      assert.ok(Math.abs(studio.x) <= 2, `studio shell x is ${studio.x}`);
    }
    const rails = await page.locator('.row, .workbench, .contact-sheet').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().width > 0).map(el => { const box = el.getBoundingClientRect(); return {left:box.left,right:box.right}; }));
    for (const box of rails) assert.ok(box.left >= -1 && box.right <= width + 1, url + ' ' + width + ' content rail');
    await context.close();
  }
});

test('below the header, nothing is boxed on four sides except the panel, the dialog, form fields, and buttons', async () => {
  for (const url of PAGES) for (const [width, height] of [[1440, 900], [390, 844]]) for (const view of url === '/work/' ? ['list', 'grid'] : ['list']) {
    const { page, context } = await open(url, { width, height, touch: width < 768 });
    if (view === 'grid') await page.click('button[data-work-view="grid"]');
    const boxed = await page.evaluate(() => [...document.querySelectorAll('main *, .site-footer *')].filter(el => {
      if (el.closest('.panel, dialog, .btn, .scene-drawing, .project-lab') || el.matches('input, select, textarea, button, kbd')) return false;
      if (location.pathname === '/' && el.closest('.studio-art-frame, [data-studio-wheel], .studio-status')) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && ['Top', 'Right', 'Bottom', 'Left'].every(side => parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none' && cs[`border${side}Color`] !== 'rgba(0, 0, 0, 0)');
    }).map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`));
    assert.deepEqual(boxed, [], `${url} ${width} ${view}`);
    await context.close();
  }
});

test('section links land each section just under the header, with smooth scrolling and without', async () => {
  for (const reduced of [false, true]) {
    const { page, context } = await open('/work/agentcrucible/', { reduced });
    const header = await page.evaluate(() => document.querySelector('.site-header').offsetHeight);
    for (const id of await page.$$eval('.toc a', as => as.map(a => a.getAttribute('href').slice(1)))) {
      const link = page.locator(`.toc a[href="#${id}"]`);
      await link.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await link.click();
      await page.waitForFunction(({ id, header }) => {
        const top = document.getElementById(id).getBoundingClientRect().top;
        const bottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
        return Math.abs(top - (header + 24)) <= 2 || (bottom && top >= header);
      }, { id, header }, { timeout: 10000 });
      await page.waitForTimeout(250);
      const { top, bottom } = await page.evaluate(i => ({ top: document.getElementById(i).getBoundingClientRect().top, bottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 2 }), id);
      if (!bottom) assert.ok(Math.abs(top - (header + 24)) <= 2, `#${id} ${reduced ? 'reduced' : 'smooth'}: top at ${top}, expected ${header + 24}`);
      else assert.ok(top >= header, `#${id} hidden under the header at the end of the page`);
    }
    await context.close();
  }
});

test('a /work link with a theme shows only that theme from the first paint, without a layout shift', async () => {
  const { page, context } = await open('/work/?theme=physics-software', { width: 1440, height: 900 });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const shifts = await page.evaluate(() => new Promise(done => {
    let sum = 0;
    new PerformanceObserver(list => { for (const e of list.getEntries()) sum += e.value; }).observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => done(sum), 300);
  }));
  assert.ok(shifts < 0.01, `layout shift ${shifts}`);
  assert.deepEqual(await page.$$eval('.project', rows => rows.filter(r => r.offsetParent).map(r => r.dataset.project)), ['airforge']);
  assert.equal(await page.getAttribute('[data-filter="physics-software"]', 'aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-filter')), false);
  await page.click('[data-filter="all"]');
  assert.equal(await page.$$eval('.project', rows => rows.filter(r => r.offsetParent).length), slugs.length);
  await context.close();
});

test('the AirForge demo loads only on request, by keyboard, framed without camera access', async () => {
  const { page, context, problems } = await open('/work/airforge/');
  const framed = [];
  await page.route('**/airforge/?example=*', route => { framed.push(route.request().url()); route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>AirForge</title><p>AirForge</p>' }); });
  await page.waitForTimeout(400);
  assert.deepEqual(framed, [], 'nothing loads before the visitor asks');
  assert.equal(await page.locator('.demo iframe').count(), 0);
  await page.locator('[data-demo-load]').focus();
  await page.keyboard.press('Enter');
  const frame = page.locator('.demo iframe');
  await frame.waitFor();
  assert.equal(await frame.getAttribute('src'), '/airforge/?example=ramp-and-ball');
  assert.equal(await frame.getAttribute('title'), 'AirForge, running live');
  assert.match(await frame.getAttribute('allow'), /camera 'none'/);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'IFRAME');
  assert.equal(await page.locator('[data-demo-load]').count(), 0);
  await page.waitForFunction(() => document.querySelector('.demo iframe').contentDocument?.title === 'AirForge');
  assert.equal(framed.length, 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  assert.deepEqual(problems, []);
  await context.close();
});

test('avatar effects settle and appearances persist independently of light mode', async () => {
  const { page, context, problems } = await open('/', { mode: 'dark' });
  await page.waitForFunction(() => window.SkyStudio?.settled() && window.SkyStudio.slug() === 'about');
  for (const [selector, value] of [['.studio-identity [data-gear-toggle]', 'two'], ['.studio-identity [data-gear-blue]', 'blue']]) {
    if (new URL(page.url()).pathname !== '/') await page.goto(site.origin + '/', { waitUntil: 'networkidle' });
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.locator(selector).click();
    await page.waitForFunction(value => document.documentElement.getAttribute('data-gear') === value, value);
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-phase'));
    await page.waitForFunction(() => !document.querySelector('.fx-ring, .fx-tide'));
    assert.equal(await page.locator('html').getAttribute('data-phase'), null);
    assert.equal(await page.locator('.fx-ring, .fx-tide').count(), 0);
    await page.goto(site.origin + '/work/');
    assert.equal(await page.locator('html').getAttribute('data-gear'), value);
  }
  await page.locator('[data-lamp]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
  assert.equal(await page.locator('html').getAttribute('data-gear'), 'blue');
  assert.deepEqual(problems, []);
  await context.close();
});

test('color modes support keyboard input and reduced motion without visual effects', async () => {
  const { page, context } = await open('/work/', { reduced: true });
  await page.locator('[data-gear-blue]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('html').getAttribute('data-gear'), 'blue');
  assert.equal(await page.locator('html').getAttribute('data-phase'), null);
  assert.equal(await page.locator('.fx-tide').count(), 0);
  await page.locator('[data-gear-blue]').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('html').getAttribute('data-gear'), null);
  await context.close();
});

test('the pointer stays native while restored avatar trails respect reduced motion', async () => {
  for (const mode of ['gear', 'blue']) {
    const { page, context } = await open('/work/', { mode });
    await page.mouse.move(200, 400);
    await page.mouse.move(800, 500, { steps: 20 });
    assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).cursor), 'none');
    if (mode === 'gear') {
      // This zero-size anchor paints a 220px pseudo-element, so inspect its paint.
      await page.waitForFunction(() => {
        const glow = document.querySelector('.fx-ember.is-on');
        if (!glow) return false;
        const anchor = getComputedStyle(glow), paint = getComputedStyle(glow, '::before');
        return Number(anchor.opacity) > 0 && anchor.display !== 'none' && paint.visibility === 'visible' && parseFloat(paint.width) >= 220 && parseFloat(paint.height) >= 220 && paint.backgroundImage !== 'none';
      });
      assert.equal(await page.locator('.fx-embers').isVisible(), true);
    }
    await page.locator('[data-motion-toggle]').click();
    assert.equal(await page.locator('.fx-embers').isVisible(), false);
    await context.close();
  }
});

test('the light switch saves its choice without clearing the selected palette', async () => {
  const { page, context } = await open('/work/');
  const lamp = page.locator('[data-lamp]');
  assert.equal(await lamp.getAttribute('aria-pressed'), 'true');
  await lamp.click();
  await page.waitForTimeout(950);
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
  assert.equal(await page.evaluate(() => localStorage.getItem('sky-theme')), 'dark');
  assert.equal(await lamp.getAttribute('aria-pressed'), 'false');
  await page.locator('[data-gear-toggle]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-gear') === 'two');
  await lamp.click();
  await page.waitForTimeout(950);
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-gear')), 'two');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
  await context.close();
});

test('the theme filter on /work shows matching projects, updates the URL, and reads it back', async () => {
  const { page, context } = await open('/work/');
  const visible = () => page.$$eval('.project', rows => rows.filter(r => !r.hidden).map(r => r.dataset.project));
  assert.equal((await visible()).length, slugs.length);
  await page.click('[data-filter="physics-software"]');
  assert.deepEqual(await visible(), ['airforge']);
  assert.match(page.url(), /\?theme=physics-software$/);
  assert.equal(await page.textContent('[data-count]'), '01');
  assert.equal(await page.getAttribute('[data-filter="physics-software"]', 'aria-pressed'), 'true');
  await page.click('[data-filter="all"]');
  assert.equal((await visible()).length, slugs.length);
  await page.goto(site.origin + '/work/?theme=ai-systems', { waitUntil: 'networkidle' });
  const ai = await visible();
  assert.ok(ai.length >= 1 && ai.length < slugs.length);
  for (const slug of ai) assert.match(await page.getAttribute(`[data-project="${slug}"]`, 'data-themes'), /ai-systems/);
  await context.close();
});

// Still portrait input and idle rendering are covered in polish.test.mjs.


test('case-study videos play on screen, pause on request, and stay still under reduced motion', async () => {
  const { page, context } = await open('/work/agentcrucible/');
  const video = page.locator('video[data-autoplay]');
  await video.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const v = document.querySelector('video[data-autoplay]'); return v && !v.paused; }, null, { timeout: 8000 });
  const button = page.locator('.fig-ctrl');
  assert.equal(await button.textContent(), 'Pause');
  await button.click();
  assert.equal(await video.evaluate(v => v.paused), true);
  assert.equal(await button.textContent(), 'Play');
  await context.close();
  const still = await open('/work/agentcrucible/', { reduced: true });
  await still.page.locator('video[data-autoplay]').scrollIntoViewIfNeeded();
  await still.page.waitForTimeout(800);
  assert.equal(await still.page.locator('video[data-autoplay]').evaluate(v => v.paused), true);
  await still.context.close();
});

test('reduced motion: the footer toggle stops smooth scrolling and makes Gear Two instant', async () => {
  const { page, context } = await open('/');
  await page.waitForFunction(() => window.SkyStudio?.settled() && window.SkyStudio.slug() === 'about');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), true);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden');
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight));
  await page.click('[data-motion-toggle]');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'reduced');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), false);
  assert.equal(await page.getAttribute('[data-motion-toggle]', 'aria-pressed'), 'true');
  await page.click('.studio-identity [data-gear-toggle]');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-gear')), 'two');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-phase')), null);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'reduced');
  await context.close();
  const os = await open('/', { reduced: true });
  assert.equal(await os.page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'reduced');
  await os.context.close();
  const study = await open('/work/agentcrucible/');
  assert.equal(await study.page.evaluate(() => document.documentElement.classList.contains('lenis')), true);
  await study.page.click('[data-motion-toggle]');
  assert.equal(await study.page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'reduced');
  assert.equal(await study.page.evaluate(() => document.documentElement.classList.contains('lenis')), false);
  await study.context.close();
});

test('keyboard: the skip link comes first, and focus is always visible', async () => {
  const { page, context } = await open('/work/agentcrucible/');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
  await page.keyboard.press('Enter');
  assert.match(page.url(), /#main$/);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth; });
    assert.match(outline, /solid 2px/, `focus ring on ${await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80))}`);
  }
  await context.close();
});

test('the home page keeps every project and a concise contact section', async () => {
  const { page, context, problems } = await open('/');
  await page.waitForFunction(() => window.SkyStudio?.settled());
  const names = await page.locator('#studio-projects .studio-row > span').allTextContents();
  assert.deepEqual(names, ['AgentCrucible', 'AirForge', 'Shipgate']);
  assert.equal(await page.locator('#about').count(), 1);
  assert.equal(await page.locator('#contact').count(), 1);
  assert.equal(await page.locator('header.studio-header').count(), 1);
  assert.equal(await page.locator('footer.studio-status').count(), 1);
  assert.equal(await page.locator('header .nav').count(), 0);
  assert.equal(await page.locator('a[href="mailto:hello@aakashdahal.fun"]').count(), 1);
  await page.locator('a[href="#contact"]').first().click();
  await page.waitForFunction(() => {
    const header = document.querySelector('.studio-header').getBoundingClientRect().bottom;
    const contact = document.getElementById('contact').getBoundingClientRect();
    return window.SkyStudio.settled() && window.SkyStudio.slug() === 'contact' && location.hash === '#contact' && contact.top >= header - 2;
  });
  assert.equal(await page.locator('[data-contact-note]').innerText(), 'Email reaches me fastest.');
  assert.deepEqual(problems, []);
  await context.close();
});

test('contact stays concise and the public page has no rendering or construction controls', async () => {
  const { page, context, problems } = await open('/');
  assert.equal((await page.textContent('[data-contact-note]')).replace(/\s+/g, ' '), 'Email reaches me fastest.');
  assert.equal(await page.locator('[data-dial], [data-grid-toggle], [data-hero-telemetry], .essentially').count(), 0);
  const models = await page.locator('details.studio-lab').evaluateAll(nodes => nodes.map(node => ({
    open: node.open,
    shown: [...node.querySelectorAll('input, select, textarea, button')].filter(el => el.checkVisibility({ visibilityProperty: true, opacityProperty: true })).length,
  })));
  assert.equal(models.length, 3);
  assert.deepEqual(await page.locator('[data-studio-pick]').evaluateAll(nodes => nodes.map(node => node.id)), ['agentcrucible', 'airforge', 'shipgate']);
  for (const model of models) {
    assert.equal(model.open, false);
    assert.equal(model.shown, 0);
  }
  assert.deepEqual(problems, []);
  await context.close();
});

test('every internal link resolves, and old /portfolio/ links land on /work/', async () => {
  const { page, context } = await open('/');
  const seen = new Set();
  for (const url of PAGES.slice(0, -1)) {
    await page.goto(site.origin + url, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.$$eval('a[href]', as => as.map(a => a.href));
    for (const href of hrefs) {
      const u = new URL(href);
      if (u.origin !== site.origin) { if (process.env.LINKS) seen.add(href); continue; }
      const key = u.pathname;
      if (seen.has(key)) continue;
      seen.add(key);
      const res = await page.request.get(site.origin + key);
      assert.equal(res.status(), 200, `${url} links to ${key}`);
    }
  }
  if (process.env.LINKS) {
    for (const href of [...seen].filter(h => h.startsWith('http') && !h.startsWith(site.origin))) {
      if (href.startsWith('mailto:')) continue;
      const res = await fetch(href, { method: 'GET', redirect: 'follow' });
      assert.ok(res.status < 400 || /x\.com/.test(href), `${href} answered ${res.status}`);
    }
  }
  await page.goto(site.origin + '/portfolio/', { waitUntil: 'networkidle' });
  assert.match(page.url(), /\/work\/$/);
  await context.close();
});
