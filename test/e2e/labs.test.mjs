import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('compact lab controls change the workbench drawings', {
  timeout: 180000,
}, async (t) => {
  const site = await serve(root);
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    await t.test('incline, policy, review, duration, tokens, notes, and votes change real output', async () => {
      const page = await open(browser, site.origin, { width: 1440, height: 900, reduced: true });
      try {
        const order = await slugs(page);
        const originals = {};
        const defaults = {};
        for (const slug of order) {
          originals[slug] = await readCard(page, slug);
          defaults[slug] = await controlValues(page, slug);
        }
        await select(page, order.indexOf('airforge'));
        const air = lab(page, 'airforge');
        const incline = air.locator('input[type="range"][data-lab-control]');
        assert.equal(await incline.count(), 1, 'AirForge exposes one incline range');
        const low = await pose(page, 'airforge', incline, await incline.getAttribute('min'));
        const high = await pose(page, 'airforge', incline, await incline.getAttribute('max'));
        assert.ok(moved(low.ball, high.ball), `incline moves the ball (${JSON.stringify(low.ball)} vs ${JSON.stringify(high.ball)})`);
        assert.ok([low.ball, high.ball].every(ball => Number.isFinite(ball.x) && Number.isFinite(ball.y)));
        const traced = await page.evaluate(() => window.__labTrace.filter(entry => entry.slug === 'airforge' && entry.event === 'before'));
        assert.ok(traced.length > 0, 'AirForge calls beforeChange before it draws');

        await select(page, order.indexOf('shipgate'));
        const ship = lab(page, 'shipgate');
        const diff = ship.locator('textarea[data-lab-control], input[type="text"][data-lab-control]');
        assert.equal(await diff.count(), 1, 'Shipgate exposes the staged diff');
        const outcomes = [];
        for (const sample of ['fix the readme typo', 'AWS_SECRET_ACCESS_KEY=AKIAEXAMPLE', 'BEGIN PRIVATE KEY', 'password = "hunter2"', '+ public comment only', '']) {
          await diff.fill(sample);
          await fire(diff);
          await pressAction(ship, /preview|scan|check|evaluate|run/i);
          const card = await readCard(page, 'shipgate');
          outcomes.push({ sample, text: `${card.output} ${card.status}`, routes: card.routes });
        }
        const blocked = outcomes.find(item => /block/i.test(item.text));
        const allowed = outcomes.find(item => /allow/i.test(item.text));
        assert.ok(blocked, `a diff is blocked (${outcomes.map(item => item.text).join(' | ')})`);
        assert.ok(allowed, `a diff is allowed (${outcomes.map(item => item.text).join(' | ')})`);
        assert.notDeepEqual(blocked.routes, allowed.routes, 'allow and block change .blocked-route');

        await select(page, order.indexOf('recall-ai'));
        const recall = lab(page, 'recall-ai');
        const again = recall.getByRole('button', { name: /again/i });
        const good = recall.getByRole('button', { name: /good/i });
        await again.click();
        const againCard = await readCard(page, 'recall-ai');
        await good.click();
        const goodCard = await readCard(page, 'recall-ai');
        assert.notDeepEqual(
          [againCard.marker, againCard.active, againCard.curves],
          [goodCard.marker, goodCard.active, goodCard.curves],
          'Again and Good move the review marker, active point, or curve',
        );
        assert.notEqual(`${againCard.output} ${againCard.status}`, `${goodCard.output} ${goodCard.status}`);

        await select(page, order.indexOf('spanforge'));
        const span = lab(page, 'spanforge');
        const duration = span.locator('input[type="range"][data-lab-control]');
        assert.equal(await duration.count(), 1, 'Spanforge exposes a duration range');
        const shortRun = await pose(page, 'spanforge', duration, await duration.getAttribute('min'));
        const longRun = await pose(page, 'spanforge', duration, await duration.getAttribute('max'));
        assert.notDeepEqual(shortRun.spans, longRun.spans, 'duration changes span rects');
        assert.ok(shortRun.spans.every(bar => Number.isFinite(+bar.width) && Number.isFinite(+bar.x)));
        const parallel = span.locator('input[type="checkbox"][data-lab-control]');
        assert.equal(await parallel.count(), 1, 'Spanforge exposes the parallel toggle');
        await parallel.setChecked(true);
        await fire(parallel);
        const sideBySide = await readCard(page, 'spanforge');
        await parallel.setChecked(false);
        await fire(parallel);
        const queued = await readCard(page, 'spanforge');
        assert.notDeepEqual(sideBySide.spans, queued.spans, 'parallel changes span positions');

        await select(page, order.indexOf('localpulse'));
        const pulse = lab(page, 'localpulse');
        const tokens = pulse.locator('input[data-lab-control]');
        assert.equal(await tokens.count(), 1, 'LocalPulse exposes a token count');
        const beforePulse = await readCard(page, 'localpulse');
        await tokens.fill('12');
        await fire(tokens);
        await pulse.getByRole('button', { name: /add/i }).click();
        await tokens.fill('7');
        await fire(tokens);
        await pulse.getByRole('button', { name: /add/i }).click();
        const afterPulse = await readCard(page, 'localpulse');
        assert.match(`${afterPulse.output} ${afterPulse.status}`, /\b19\b/, 'token aggregation reports 12 + 7');
        assert.ok(afterPulse.bars.join() !== beforePulse.bars.join() || afterPulse.wave !== beforePulse.wave, 'the series changes .pulse-bar or .pulse-wave');

        await select(page, order.indexOf('ghost-notetaker'));
        const ghost = lab(page, 'ghost-notetaker');
        const note = ghost.locator('textarea[data-lab-control]');
        const payload = 'Keep <script>alert(1)</script> & <b>bold</b> literal';
        await note.fill(payload);
        await pressAction(ghost, /capture/i);
        const noted = await readCard(page, 'ghost-notetaker');
        assert.ok(`${noted.notes.join('\n')}\n${noted.output}`.includes('<script>alert(1)</script>'), 'the note is inserted as text');
        assert.ok(`${noted.notes.join('\n')}\n${noted.output}`.includes('<b>bold</b>'), 'markup in the note stays literal');
        assert.equal(noted.unsafe, false, 'the note does not become markup');

        await select(page, order.indexOf('moltdao'));
        const molt = lab(page, 'moltdao');
        const yes = molt.getByRole('button', { name: /yes|for|approve/i });
        const no = molt.getByRole('button', { name: /no|against|reject/i });
        for (let i = 0; i < 4; i++) await yes.click();
        const carried = await readCard(page, 'moltdao');
        for (let i = 0; i < 7; i++) await no.click();
        const lost = await readCard(page, 'moltdao');
        assert.notDeepEqual(carried.voters, lost.voters, 'votes change .voter fills');
        assert.notDeepEqual(carried.links, lost.links, 'votes change .vote-link');
        assert.notEqual(`${carried.output} ${carried.status}`, `${lost.output} ${lost.status}`);
        assert.match(`${carried.output} ${carried.status} ${lost.output} ${lost.status}`, /majority|yes|no|pass|fail|approv|reject|treasur/i);

        await select(page, order.indexOf('shipgate'));
        await select(page, order.indexOf('airforge'));
        assert.deepEqual(await controlValues(page, 'airforge'), defaults.airforge, 'leaving AirForge resets its controls');
        assert.deepEqual(await readCard(page, 'airforge').then(card => [card.ball.cx, card.ball.cy, card.ball.transform, card.ball.style]), [originals.airforge.ball.cx, originals.airforge.ball.cy, originals.airforge.ball.transform, originals.airforge.ball.style]);
        assert.equal(await page.evaluate(() => window.__labs.airforge.activated()), false, 'AirForge deactivates on selection reset');
        await select(page, order.indexOf('shipgate'));
        assert.deepEqual(await controlValues(page, 'shipgate'), defaults.shipgate, 'leaving Shipgate clears the staged diff');
        assert.deepEqual((await readCard(page, 'shipgate')).routes, originals.shipgate.routes);
        assert.equal(await page.evaluate(() => window.__labs.shipgate.activated()), false);

        await select(page, order.indexOf('airforge'));
        const keyboard = lab(page, 'airforge').locator('input[type="range"][data-lab-control]');
        await keyboard.focus();
        const beforeKey = await keyboard.inputValue();
        const beforeBall = (await readCard(page, 'airforge')).ball;
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        const afterKey = await keyboard.inputValue();
        assert.notEqual(afterKey, beforeKey, 'the incline range takes keyboard input');
        const afterBall = (await readCard(page, 'airforge')).ball;
        assert.notDeepEqual(
          [afterBall.cx, afterBall.cy, afterBall.x, afterBall.y, afterBall.transform],
          [beforeBall.cx, beforeBall.cy, beforeBall.x, beforeBall.y, beforeBall.transform],
          'keyboard incline moves the ball',
        );
        assert.deepEqual(await page.evaluate(() => window.__pageErrors), []);
      } finally {
        await page.context().close();
      }
    });

    await t.test('pause, hidden tabs, and offscreen drawings hold the ramp and resume it', async () => {
      const page = await open(browser, site.origin, { width: 1440, height: 900, reduced: false });
      try {
        await select(page, (await slugs(page)).indexOf('airforge'));
        await lab(page, 'airforge').getByRole('button', { name: 'Drop', exact: true }).click();
        await page.waitForFunction(() => window.__labs.airforge.activated());
        await page.locator('[data-bench-live]').click();
        const held = (await readCard(page, 'airforge')).ball;
        await frames(page, 8);
        assert.deepEqual((await readCard(page, 'airforge')).ball, held, 'pause holds the real ball');
        await page.locator('[data-bench-live]').click();
        await frames(page, 8);
        assert.notDeepEqual((await readCard(page, 'airforge')).ball, held, 'play continues the real ball');
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        const hidden = (await readCard(page, 'airforge')).ball;
        await frames(page, 8);
        assert.deepEqual((await readCard(page, 'airforge')).ball, hidden, 'hidden tab holds the ball');
        await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
        await page.setViewportSize({ width: 1440, height: 480 });
        await page.locator('#contact').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => window.__labs.airforge.snapshot().paused);
        const offscreen = (await readCard(page, 'airforge')).ball;
        await frames(page, 8);
        assert.deepEqual((await readCard(page, 'airforge')).ball, offscreen, 'offscreen drawing holds the ball');
        await page.locator('#project-airforge .scene-drawing').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => !window.__labs.airforge.snapshot().paused);
        assert.deepEqual(await page.evaluate(() => window.__pageErrors), []);
      } finally { await page.context().close(); }
    });

    await t.test('reduced motion settles the incline immediately', async () => {
      const page = await open(browser, site.origin, { width: 1280, height: 800, reduced: true });
      try {
        const order = await slugs(page);
        await select(page, order.indexOf('airforge'));
        const incline = lab(page, 'airforge').locator('input[type="range"][data-lab-control]');
        await incline.fill(await incline.getAttribute('max'));
        await fire(incline);
        const first = (await readCard(page, 'airforge')).ball;
        await frames(page, 3);
        const held = (await readCard(page, 'airforge')).ball;
        assert.deepEqual(held, first, 'reduced motion does not keep integrating the ramp');
        assert.equal(await page.evaluate(() => window.SkyMotion.reduced()), true);
      } finally {
        await page.context().close();
      }
    });

    await t.test('a narrow viewport still changes the drawing without page overflow', async () => {
      const page = await open(browser, site.origin, { width: 390, height: 844, reduced: true });
      try {
        const order = await slugs(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `homepage overflows by ${overflow}px`);
        await select(page, order.indexOf('localpulse'));
        const pulse = lab(page, 'localpulse');
        const box = await pulse.boundingBox();
        assert.ok(box.width <= 390, 'the controls fit the narrow viewport');
        const before = await readCard(page, 'localpulse');
        await pulse.locator('input[data-lab-control]').fill('5');
        await pulse.getByRole('button', { name: /add/i }).click();
        const after = await readCard(page, 'localpulse');
        assert.match(`${after.output} ${after.status}`, /\b5\b/);
        assert.ok(after.bars.join() !== before.bars.join() || after.wave !== before.wave);
        const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflowAfter <= 1, `controls overflow the page by ${overflowAfter}px`);
      } finally {
        await page.context().close();
      }
    });
  } finally {
    await browser.close();
    site.server.close();
  }
});

function lab(page, slug) {
  return page.locator(`#project-${slug} .lab-controls[data-lab-slug="${slug}"]`);
}

async function open(browser, origin, options) {
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    reducedMotion: options.reduced ? 'reduce' : 'no-preference',
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  await context.addInitScript(() => {
    sessionStorage.setItem('sky-intro', 'seen');
    window.__pageErrors = [];
    window.__labTrace = [];
    window.__labs = {};
    let api;
    const wrap = value => {
      if (!value || value.__wrapped || typeof value.mount !== 'function') return value;
      const mount = value.mount.bind(value);
      value.mount = (card, slug, hooks) => {
        const handle = mount(card, slug, {
          beforeChange() {
            const ball = card.querySelector('.physics-ball');
            window.__labTrace.push({ slug, event: 'before', cy: ball && ball.getAttribute('cy') });
            if (hooks && hooks.beforeChange) return hooks.beforeChange();
          },
          status(text) {
            window.__labTrace.push({ slug, event: 'status', text });
            if (hooks && hooks.status) return hooks.status(text);
          },
        });
        window.__labs[slug] = handle;
        return handle;
      };
      value.__wrapped = true;
      return value;
    };
    Object.defineProperty(window, 'SkyLabControls', {
      configurable: true,
      get() { return api; },
      set(value) { api = wrap(value); },
    });
    window.addEventListener('error', event => window.__pageErrors.push(String(event.message)));
  });
  const page = await context.newPage();
  page.on('pageerror', error => page.evaluate(message => window.__pageErrors.push(message), String(error)).catch(() => {}));
  await page.goto(origin + '/#work-list', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.workbench.is-ready') && window.SkyWorkbench && window.SkyLabControls);
  return page;
}

async function slugs(page) {
  return page.evaluate(() => JSON.parse(document.getElementById('workbench-data').textContent).map(row => row.slug));
}

async function select(page, index) {
  const current = page.locator('[data-work-pick][aria-pressed="true"]');
  await current.focus();
  await current.press('Home');
  for (let i = 0; i < index; i++) await page.keyboard.press('ArrowRight');
  await page.waitForFunction(index => {
    const pick = document.querySelector(`[data-work-pick="${index}"]`);
    const card = document.getElementById(pick.getAttribute('aria-controls'));
    return window.SkyWorkbench.settled() && card.classList.contains('is-on') && !card.inert;
  }, index);
}

async function readCard(page, slug) {
  return page.locator(`#project-${slug}`).evaluate(card => {
    const ball = card.querySelector('.physics-ball');
    const rect = ball ? ball.getBoundingClientRect() : null;
    const round = value => Math.round(value * 10) / 10;
    return {
      ball: ball && {
        cx: ball.getAttribute('cx'), cy: ball.getAttribute('cy'), transform: ball.getAttribute('transform'), style: ball.getAttribute('style'),
        x: round(rect.x), y: round(rect.y),
      },
      routes: [...card.querySelectorAll('.blocked-route')].map(node => ({
        opacity: node.style.opacity, text: node.textContent.trim(), d: node.getAttribute('d'), hidden: node.getAttribute('hidden'),
      })),
      marker: card.querySelector('.recall-marker')?.getAttribute('d'),
      markerTransform: card.querySelector('.recall-marker')?.getAttribute('transform'),
      markerStyle: card.querySelector('.recall-marker')?.getAttribute('style'),
      active: card.querySelector('.recall-active')?.getAttribute('cx'),
      activeStyle: card.querySelector('.recall-active')?.getAttribute('style'),
      curves: [...card.querySelectorAll('.scene-art path.contour')].map(node => node.getAttribute('d')),
      spans: [...card.querySelectorAll('.trace-span')].map(node => {
        const rect = node.querySelector('rect');
        return { name: node.querySelector('text')?.textContent.trim(), x: rect.getAttribute('x'), width: rect.getAttribute('width') };
      }),
      bars: [...card.querySelectorAll('.pulse-bar')].map(node => node.getAttribute('height')),
      wave: card.querySelector('.pulse-wave')?.getAttribute('d'),
      voters: [...card.querySelectorAll('.voter')].map(node => node.getAttribute('fill') || node.style.fill || ''),
      links: [...card.querySelectorAll('.vote-link')].map(node => `${node.getAttribute('stroke') || ''}|${node.style.stroke}|${node.style.opacity}`),
      notes: [...card.querySelectorAll('svg text')].map(node => node.textContent),
      unsafe: !!card.querySelector('svg script, svg img, svg iframe'),
      output: card.querySelector('.lab-output')?.textContent.trim() || '',
      status: card.querySelector('[data-scene-status]')?.textContent.trim() || '',
    };
  });
}

async function controlValues(page, slug) {
  return lab(page, slug).evaluate(root => [...root.querySelectorAll('[data-lab-control]')].map(node => [
    node.getAttribute('data-lab-control'),
    node.matches('input[type="checkbox"], input[type="radio"]') ? String(node.checked) : node.value,
  ]));
}

async function fire(locator) {
  await locator.evaluate(node => {
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function pressAction(root, pattern) {
  const buttons = root.locator('[data-lab-action]');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    const name = `${await button.getAttribute('data-lab-action')} ${await button.innerText()}`;
    if (pattern.test(name)) {
      await button.click();
      return;
    }
  }
  assert.fail(`no [data-lab-action] matched ${pattern}`);
}

async function frames(page, count) {
  for (let i = 0; i < count; i++) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}

async function pose(page, slug, control, value) {
  await control.fill(String(value));
  await fire(control);
  await pressAction(lab(page, slug), /drop|run|simulate|apply|trace/i);
  let last = await readCard(page, slug);
  let stable = 0;
  for (let i = 0; i < 90 && stable < 2; i++) {
    await frames(page, 1);
    const next = await readCard(page, slug);
    stable = JSON.stringify(next.ball) === JSON.stringify(last.ball) && JSON.stringify(next.spans) === JSON.stringify(last.spans) ? stable + 1 : 0;
    last = next;
  }
  return last;
}

function moved(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) > 4;
}
