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
  const blocks = '.row > *, .plate > *, .plate-caption > *, .project > *, .hang-list > * > *, .prose > section > *, .case-title > *, .aside > *, .numbers dl > * > *, .meta dd';
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

test('below the header, nothing is boxed on four sides except the panel, the dialog, form fields, and buttons', async () => {
  for (const url of PAGES) for (const [width, height] of [[1440, 900], [390, 844]]) for (const view of url === '/work/' ? ['list', 'grid'] : ['list']) {
    const { page, context } = await open(url, { width, height, touch: width < 768 });
    if (view === 'grid') await page.click('button[data-work-view="grid"]');
    const boxed = await page.evaluate(() => [...document.querySelectorAll('main *, .site-footer *')].filter(el => {
      if (el.closest('.panel, dialog, .btn') || el.matches('input, select, textarea')) return false;
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

test('the home theme links brighten the ring for a moment, and the figure takes a click', async () => {
  const { page, context, problems } = await open('/');
  await page.waitForFunction(() => document.getElementById('figure').classList.contains('is-live'));
  const count = await page.textContent('[data-dot-count]');
  assert.ok(Number(count.replace(/,/g, '')) > 5000, `dot count ${count}`);
  assert.match(await page.getAttribute('#figure', 'aria-label'), new RegExp(`a ring that reads: ${await page.getAttribute('#figure', 'data-ring')}\\.$`));
  await page.waitForTimeout(2200);
  // per frame, how strongly the ring draws its glyphs (the sum of their alphas): steady while it turns, higher while brightened
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype, fill = proto.fillText, clear = proto.clearRect;
    let sum = 0;
    window.__ring = [];
    proto.clearRect = function (...args) {
      if (this.canvas.classList.contains('hero-words')) { if (sum) window.__ring.push([performance.now(), sum]); sum = 0; }
      return clear.apply(this, args);
    };
    proto.fillText = function (...args) {
      if (this.canvas.classList.contains('hero-words')) sum += this.globalAlpha;
      return fill.apply(this, args);
    };
  });
  await page.waitForTimeout(600);
  const hovered = await page.evaluate(() => performance.now());
  await page.hover('[data-theme-link="developer-tools"]');
  await page.waitForTimeout(1100);
  const frames = await page.evaluate(() => window.__ring);
  const median = list => list.slice().sort((a, b) => a - b)[list.length >> 1];
  const rest = median(frames.filter(([time]) => time < hovered).map(([, v]) => v));
  const peak = Math.max(...frames.filter(([time]) => time > hovered && time < hovered + 500).map(([, v]) => v));
  const after = median(frames.filter(([time]) => time > hovered + 700).map(([, v]) => v));
  assert.ok(peak > rest * 1.3, `hovering a theme brightens the ring (${rest.toFixed(1)} -> ${peak.toFixed(1)})`);
  assert.ok(after < rest * 1.1, `and it settles back within 400 ms (${peak.toFixed(1)} -> ${after.toFixed(1)})`);
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

test('section rules draw in and plates develop from a stipple drawing, once seen, except under reduced motion', async () => {
  const { page, context, problems } = await open('/');
  const band = page.locator('#contact .band');
  assert.equal(await band.evaluate(el => el.classList.contains('is-seen')), false, 'a rule below the fold waits');
  assert.equal(await band.evaluate(el => getComputedStyle(el, '::before').transform), 'matrix(0, 0, 0, 1, 0, 0)', 'the waiting rule has no width');
  const plate = page.locator('#selected .plate-wide.plate-right .plate-media');
  assert.equal(await plate.evaluate(el => el.classList.contains('is-stippled') && !!el.querySelector('canvas.stipple')), true, 'a plate waits as a drawing');
  assert.equal(await plate.evaluate(el => getComputedStyle(el.querySelector('img')).opacity), '0', 'its screenshot waits under the drawing');
  await plate.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#selected .plate-wide.plate-right .plate-media').classList.contains('is-developed'));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#selected .plate-wide.plate-right .plate-media img')).opacity === '1');
  const inked = await plate.evaluate(el => { const c = el.querySelector('canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n / (d.length / 4); });
  assert.ok(inked > 0.05 && inked < 0.9, `the drawing is stippled, not blank or solid (${inked.toFixed(2)})`);
  await band.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#contact .band'), '::before').transform === 'none');
  assert.deepEqual(problems, []);
  await context.close();
  const still = await open('/', { reduced: true });
  assert.equal(await still.page.locator('#selected .plate-media.is-stippled').count(), 0, 'no drawing under reduced motion');
  assert.equal(await still.page.locator('#selected .plate-media img').first().evaluate(el => getComputedStyle(el).opacity), '1', 'the screenshot is simply there');
  assert.equal(await still.page.locator('#contact .band').evaluate(el => getComputedStyle(el).borderTopColor !== 'rgba(0, 0, 0, 0)'), true, 'the rule is simply there under reduced motion');
  await still.context.close();
});

test('contact reads my time off a 24-hour dial, and G draws the construction grid for the session', async () => {
  const { page, context, problems } = await open('/');
  assert.match(await page.textContent('[data-contact-note]'), /^It’s \d\d:\d\d for me, so I’m probably [a-z ,’]+\. Email reaches me fastest\.$/);
  const dial = page.locator('[data-dial] svg');
  await dial.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  assert.ok(await page.locator('[data-dial-night] circle').count() > 200, 'the night is stippled in');
  assert.equal(await page.locator('[data-dial-hands] .hand').count(), 1);
  assert.match(await page.textContent('[data-dial-time]'), /^\d\d:\d\d$/);
  const box = await dial.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * (104 / 448));
  assert.equal(await page.textContent('[data-dial-time]'), '12:00', 'pointing at the top of the dial reads noon');
  assert.equal(await page.textContent('[data-dial-status]'), 'Probably writing tests');
  await page.mouse.move(5, 5);
  assert.match(await page.textContent('[data-dial-place]'), /now/);
  await page.keyboard.press('g');
  assert.equal(await page.getAttribute('html', 'data-grid'), 'on');
  assert.deepEqual(await page.$$eval('[data-grid-toggle]', bs => bs.map(b => b.getAttribute('aria-pressed'))), ['true', 'true']);
  assert.notEqual(await page.locator('body > .lines span').first().evaluate(el => getComputedStyle(el, '::before').content), 'none', 'the minor columns and insets are drawn');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getAttribute('html', 'data-grid'), 'on', 'it lasts for the session');
  await page.locator('.sign-off [data-grid-toggle]').click();
  assert.equal(await page.getAttribute('html', 'data-grid'), null);
  assert.equal(await page.textContent('.sign-off [data-grid-state]'), 'Off');
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
