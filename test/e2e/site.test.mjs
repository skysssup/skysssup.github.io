// End-to-end checks in Chromium: every page at four widths in light, dark, and Gear Two, with axe-core,
// plus the interactions. Run with `npm run test:e2e` (CHROME_PATH may point at a local Chrome).
// SHOTS=<dir> also saves a screenshot of every page/width/mode; LINKS=1 checks external links too.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const slugs = fs.readdirSync(path.join(root, 'work')).filter(d => fs.existsSync(path.join(root, 'work', d, 'index.html')));
const PAGES = (process.env.PAGES ? process.env.PAGES.split(',') : ['/', '/work/', ...slugs.map(s => `/work/${s}/`), '/missing-page']);
const WIDTHS = [[1440, 900], [1280, 800], [768, 1024], [390, 844]];
const MODES = ['light', 'dark', 'gear'];
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
        localStorage.setItem('sky-theme', m === 'light' ? 'light' : 'dark');
        if (m === 'gear') sessionStorage.setItem('sky-gear', 'two');
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

test('every page loads cleanly at every width in light, dark, and Gear Two', async () => {
  for (const url of PAGES) for (const [width, height] of WIDTHS) for (const mode of MODES) {
    const { page, context, problems } = await open(url, { width, height, mode, touch: width < 768 });
    await page.waitForTimeout(url === '/' ? 1800 : 300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `${url} ${width} ${mode} overflows by ${overflow}px`);
    const unexpected = url === '/missing-page' ? problems.filter(p => !/status of 404/.test(p)) : problems;
    assert.deepEqual(unexpected, [], `${url} ${width} ${mode}`);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-gear')), mode === 'gear' ? 'two' : null);
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

test('content sits on the sheet: left edges on a line or its inset, right-aligned ends likewise, centred blocks on a line', async () => {
  const blocks = '.row > *, .project > *, .contact-rows > * > *, .prose > section > *, .case-title > *, .aside > *, .meta dd';
  for (const url of PAGES) for (const [width, height] of WIDTHS) {
    const { page, context } = await open(url, { width, height, touch: width < 768 });
    const off = await page.evaluate(sel => {
      const spans = [...document.querySelectorAll('body > .lines > span')].filter(s => getComputedStyle(s).display !== 'none');
      const majors = spans.map(s => s.getBoundingClientRect().left).concat(spans[spans.length - 1].getBoundingClientRect().right);
      const lines = majors.flatMap((x, i) => i < majors.length - 1 ? [x, x + (majors[i + 1] - x) / 3, x + (majors[i + 1] - x) * 2 / 3] : [x]);
      const p = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--p'));
      const near = (x, list) => list.some(a => Math.abs(a - x) <= 0.5);
      const found = [];
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (el.closest('.site-header') || cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed' || !r.width || !r.height) continue;
        const inner = [r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)];
        let ok;
        if (cs.justifySelf === 'center') ok = near((r.left + r.right) / 2, lines);
        else if (cs.justifySelf === 'end') ok = near(r.right, lines) || near(inner[1], lines.map(x => x - p));
        else ok = near(r.left, lines.flatMap(x => [x, x + p])) || near(inner[0], lines.flatMap(x => [x, x + p]));
        if (!ok) found.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} at ${r.left.toFixed(1)}–${r.right.toFixed(1)}`);
      }
      return found;
    }, blocks);
    assert.deepEqual(off, [], `${url} ${width}`);
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
      for (let last = -1, i = 0; i < 50; i++) {
        await page.waitForTimeout(100);
        const y = await page.evaluate(() => scrollY);
        if (y === last && i >= 3) break;
        last = y;
      }
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

test('Gear Two flashes, glitches, settles, turns the page red, and survives navigation', async () => {
  const { page, context, problems } = await open('/');
  await page.waitForFunction(() => document.getElementById('figure').classList.contains('is-live'));
  await page.waitForTimeout(1500);
  const gear = page.locator('[data-gear-toggle]');
  await page.evaluate(() => {
    const root = document.documentElement;
    window.phases = [];
    window.ringSeen = false;
    new MutationObserver(() => window.phases.push([root.getAttribute('data-phase'), root.getAttribute('data-gear')])).observe(root, { attributes: true, attributeFilter: ['data-phase'] });
    new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.classList?.contains('fx-ring')) window.ringSeen = true; }).observe(document.body, { childList: true });
  });
  await gear.click();
  await page.waitForFunction(() => window.phases.length >= 4);
  assert.deepEqual(await page.evaluate(() => window.phases), [['flash', null], ['glitch', 'two'], ['settle', 'two'], [null, 'two']]);
  assert.equal(await gear.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => window.ringSeen), true, 'a shockwave ring leaves the switch');
  await page.waitForFunction(() => !document.querySelector('.fx-ring'), null, { timeout: 3000 });
  assert.match(await page.evaluate(() => document.documentElement.style.getPropertyValue('--beat-delay')), /^-0\.\d+s$/, 'CSS pulses are phased to the heartbeat clock');
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  assert.equal(accent.toLowerCase(), '#ff3b30');
  assert.equal(await page.evaluate(() => document.getElementById('figure').classList.contains('is-live')), true, 'the hero keeps drawing through the glitch');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.hero-figure'), '::before').backgroundImage), 'none', 'the figure glows in Gear Two');
  assert.match(await page.textContent('[data-hero-telemetry]'), /bpm/, 'the readout shows the heartbeat');
  await page.click('a[href="/work/"]');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-gear')), 'two');
  await page.locator('[data-gear-toggle]').click();
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-gear'));
  assert.deepEqual(problems, []);
  await context.close();
});

test('the light switch flips and saves the theme, and turning the lights on leaves Gear Two', async () => {
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
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-gear')), null);
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

test('the home theme links light up their projects on the figure', async () => {
  const { page, context, problems } = await open('/');
  await page.waitForFunction(() => document.getElementById('figure').classList.contains('is-live'));
  const count = await page.textContent('[data-dot-count]');
  assert.ok(Number(count.replace(/,/g, '')) > 5000, `dot count ${count}`);
  await page.hover('[data-theme-link="developer-tools"]');
  await page.waitForTimeout(200);
  const fig = page.locator('#figure');
  const box = await fig.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(400);
  assert.deepEqual(problems, []);
  await context.close();
});

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
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), true);
  await page.click('[data-motion-toggle]');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'reduced');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), false);
  assert.equal(await page.getAttribute('[data-motion-toggle]', 'aria-pressed'), 'true');
  await page.click('[data-gear-toggle]');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-gear')), 'two');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-phase')), null);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'reduced');
  await context.close();
  const os = await open('/', { reduced: true });
  assert.equal(await os.page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'reduced');
  assert.equal(await os.page.evaluate(() => !!document.querySelector('.cat') && !document.querySelector('.cat').hidden), false);
  await os.context.close();
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

test('the cat follows a mouse, and stays away on touch screens', async () => {
  const { page, context } = await open('/work/');
  await page.mouse.move(200, 300);
  await page.waitForTimeout(150);
  const first = await page.$eval('.cat', c => c.style.transform);
  await page.mouse.move(1200, 600, { steps: 10 });
  await page.waitForTimeout(1200);
  assert.notEqual(await page.$eval('.cat', c => c.style.transform), first);
  await context.close();
  const touch = await open('/work/', { width: 390, height: 844, touch: true });
  assert.equal(await touch.page.$('.cat'), null);
  await touch.context.close();
});

test('the stack matrix draws in once seen, lights a column on hover, and reads as a list on small screens', async () => {
  const { page, context, problems } = await open('/');
  const dot = page.locator('.matrix-cell[data-on] .dot').first();
  assert.equal(await page.evaluate(() => document.querySelector('.matrix').classList.contains('is-seen')), false, 'the matrix waits below the fold');
  assert.equal(await dot.evaluate(el => getComputedStyle(el).transform), 'matrix(0, 0, 0, 0, 0, 0)', 'dots start collapsed');
  await page.locator('#stack').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.matrix').classList.contains('is-seen'));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.matrix-cell[data-on] .dot')).transform === 'none');
  const rows = await page.$$eval('.matrix-row', rows => rows.map(r => ({ tech: r.querySelector('.matrix-tech .t-small').textContent, n: Number(r.querySelector('.matrix-tech .num').textContent), dots: r.querySelectorAll('[data-on]').length })));
  assert.ok(rows.length >= 10);
  for (const row of rows) assert.equal(row.dots, row.n, `${row.tech} shows ${row.dots} dots for ${row.n} projects`);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].n <= rows[i - 1].n, 'technologies are ordered by use');
  await page.hover('.matrix-project[data-col="2"] a');
  await page.waitForFunction(() => document.querySelector('.matrix').getAttribute('data-hover-col') === '2');
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => !document.querySelector('.matrix').hasAttribute('data-hover-col'));
  await page.focus('.matrix-project[data-col="5"] a');
  assert.equal(await page.getAttribute('.matrix', 'data-hover-col'), '5');
  assert.equal(await page.getAttribute('.matrix-tech a', 'href'), '/work/?q=typescript');
  assert.deepEqual(problems, []);
  await context.close();
  const small = await open('/', { width: 390, height: 844, touch: true });
  assert.equal(await small.page.locator('.matrix-head').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await small.page.locator('.matrix-cell[data-on] .matrix-name').first().evaluate(el => getComputedStyle(el).position), 'static', 'project names read inline');
  await small.context.close();
});

test('section rules draw in, media wipes in, and the colophon counts up, except under reduced motion', async () => {
  const { page, context } = await open('/');
  assert.equal(await page.locator('#stack .section-head').evaluate(el => el.classList.contains('is-seen')), false, 'a rule below the fold waits');
  assert.equal(await page.locator('#stack .section-head').evaluate(el => getComputedStyle(el, '::before').transform), 'matrix(0, 0, 0, 1, 0, 0)', 'the waiting rule has no width');
  const figure = page.locator('.figures dt').first();
  const printed = await figure.textContent();
  await page.locator('#colophon').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.figures').classList.contains('is-seen'));
  await page.waitForFunction(printed => document.querySelector('.figures dt').textContent === printed, printed, { timeout: 3000 });
  assert.equal(await page.evaluate(() => document.querySelector('#colophon .section-head').classList.contains('is-seen')), true);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#colophon .section-head'), '::before').transform === 'none');
  await page.locator('#selected .card-media').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#selected .card-media').classList.contains('is-seen'));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#selected .card-media > img')).clipPath === 'inset(0px)');
  await context.close();
  const still = await open('/', { reduced: true });
  assert.equal(await still.page.locator('#selected .card-media > img').first().evaluate(el => getComputedStyle(el).clipPath), 'none', 'nothing is clipped under reduced motion');
  assert.equal(await still.page.locator('.matrix-cell[data-on] .dot').first().evaluate(el => getComputedStyle(el).transform), 'none', 'dots are simply there under reduced motion');
  assert.equal(await still.page.locator('.figures dt').first().textContent(), printed, 'the printed number stands as is');
  await still.context.close();
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
